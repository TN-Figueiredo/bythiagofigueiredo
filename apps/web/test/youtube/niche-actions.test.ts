import { describe, it, expect, vi, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))
import { parseNiche } from '@/lib/youtube/observatorio/niche'

vi.mock('server-only', () => ({}))

describe('parseNiche', () => {
  it('accepts todos and any well-formed niche slug (existence is the engine\'s and the actions\' job)', () => {
    expect(parseNiche('ia')).toBe('ia')
    expect(parseNiche('todos')).toBe('todos')
    expect(parseNiche('culinaria')).toBe('culinaria')
  })
  it('rejects anything that is not a slug', () => {
    expect(parseNiche('Não Vale')).toBeNull()
    expect(parseNiche('')).toBeNull()
    expect(parseNiche(undefined)).toBeNull()
  })
})

describe('getUserNiche', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('defaults to todos when there is no row', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
  })

  it('returns todos when requireSiteScope fails', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: false }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    const getSupabaseServiceClientMock = vi.fn()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: getSupabaseServiceClientMock }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
    expect(getSupabaseServiceClientMock).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ fake client shared by the write actions */
type NicheRow = { slug: string; label: string; color_dark: string; color_light: string; sort_order: number }
const VIAGEM: NicheRow = { slug: 'viagem', label: 'Viagem', color_dark: '#5BBF8A', color_light: '#11692F', sort_order: 10 }
const IA: NicheRow = { slug: 'ia', label: 'IA', color_dark: '#6EA8FE', color_light: '#1D4ED8', sort_order: 20 }
const JOGOS: NicheRow = { slug: 'jogos', label: 'Jogos', color_dark: '#D29AE8', color_light: '#7B2A91', sort_order: 100 }
interface SetupOpts {
  auth?: { ok: boolean; user?: { id: string } }
  /** youtube_niches rows; `missing` = the table is not in this database yet (42P01); `broken` = another read error. */
  niches?: NicheRow[] | 'missing' | 'broken'
  result?: { error: Error | null; data: unknown[] | null }
}
function setup(opts: SetupOpts = {}) {
  vi.resetModules()
  const order: string[] = []
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => { order.push('guard'); return opts.auth ?? { ok: true, user: { id: 'u1' } } } }))
  const revalidatePathMock = vi.fn()
  vi.doMock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
  const selectMock = vi.fn(async () => opts.result ?? { error: null, data: [{ id: 'ch1' }] })
  const secondEqMock = vi.fn(() => ({ select: selectMock }))
  const firstEqMock = vi.fn(() => ({ eq: secondEqMock }))
  const updateMock = vi.fn(() => ({ eq: firstEqMock }))
  const upsertMock = vi.fn(async () => ({ error: null }))
  const nichesRead = vi.fn()
  const niches = opts.niches ?? [VIAGEM, IA]
  const nicheRes = niches === 'missing' ? { data: null, error: { code: '42P01', message: 'relation "public.youtube_niches" does not exist' } }
    : niches === 'broken' ? { data: null, error: { code: '57014', message: 'timeout' } } : { data: niches, error: null }
  const nq = { eq: (c: string, v: string) => { nichesRead(c, v); return nq }, order: () => nq, then: (ok: (r: typeof nicheRes) => unknown) => Promise.resolve(nicheRes).then(ok) }
  const fromMock = vi.fn((table: string) => { order.push('from:' + table); return table === 'youtube_niches' ? { select: () => nq } : { update: updateMock, upsert: upsertMock } })
  const clientMock = vi.fn(() => ({ from: fromMock }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: clientMock }))
  return { revalidatePathMock, fromMock, updateMock, upsertMock, firstEqMock, secondEqMock, clientMock, nichesRead, order }
}
const actions = () => import('@/app/cms/(authed)/youtube/competitors/niche-actions')
afterEach(() => { vi.resetModules(); vi.clearAllMocks() })

describe('setUserNiche', () => {
  it('rejects a value that is not a niche slug and does not call getSupabaseServiceClient', async () => {
    const m = setup()
    expect(await (await actions()).setUserNiche('Não Vale')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
  })
  it('upserts with correct user_id and site_id from auth and context', async () => {
    const m = setup()
    expect(await (await actions()).setUserNiche('ia')).toEqual({ ok: true })
    expect(m.fromMock).toHaveBeenCalledWith('competitor_user_prefs')
    expect(m.upsertMock.mock.calls[0]![0]).toMatchObject({ user_id: 'u1', site_id: 's1', niche: 'ia' })
  })
  it("'todos' is saved without reading the niches", async () => {
    const m = setup()
    expect(await (await actions()).setUserNiche('todos')).toEqual({ ok: true })
    expect(m.fromMock).not.toHaveBeenCalledWith('youtube_niches')
    expect(m.upsertMock.mock.calls[0]![0]).toMatchObject({ niche: 'todos' })
  })
  it('a niche the owner created is saved', async () => {
    const m = setup({ niches: [VIAGEM, IA, JOGOS] })
    expect(await (await actions()).setUserNiche('jogos')).toEqual({ ok: true })
    expect(m.nichesRead).toHaveBeenCalledWith('site_id', 's1')
    expect(m.upsertMock.mock.calls[0]![0]).toMatchObject({ niche: 'jogos' })
  })
  it('a well-formed niche that does not exist in the site is refused and nothing is written', async () => {
    const m = setup()
    expect(await (await actions()).setUserNiche('sumiu')).toEqual({ ok: false })
    expect(m.upsertMock).not.toHaveBeenCalled()
  })
  it('returns ok:false when requireSiteScope fails (no service client)', async () => {
    const m = setup({ auth: { ok: false } })
    expect(await (await actions()).setUserNiche('viagem')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
  })
})

describe.each([
  ['setChannelNiche', 'competitor_channels'],
  ['setOwnChannelNiche', 'youtube_channels'],
] as const)('%s', (name, table) => {
  const load = async () => (await actions())[name]

  it('rejects a value that is not a niche slug without touching the DB or revalidating', async () => {
    const m = setup()
    expect(await (await load())('ch1', 'Não Vale')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })
  it('without edit permission: refused, the service client is never created', async () => {
    const m = setup({ auth: { ok: false } })
    expect(await (await load())('ch1', 'ia')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
    expect(m.updateMock).not.toHaveBeenCalled()
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })
  it('the guard runs before any read: guard, then the niches, then the update', async () => {
    const m = setup({ niches: [VIAGEM, IA, JOGOS] })
    expect(await (await load())('ch1', 'jogos')).toEqual({ ok: true })
    expect(m.order).toEqual(['guard', 'from:youtube_niches', 'from:' + table])
  })
  it('a niche the owner created (in the table) is accepted: the update carries the slug', async () => {
    const m = setup({ niches: [VIAGEM, IA, JOGOS] })
    expect(await (await load())('ch1', 'jogos')).toEqual({ ok: true })
    expect(m.nichesRead).toHaveBeenCalledWith('site_id', 's1')
    expect(m.updateMock).toHaveBeenCalledWith({ niche: 'jogos' })
    expect(m.revalidatePathMock).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('a well-formed niche that is NOT in the table is refused: no update, no revalidate', async () => {
    const m = setup()
    expect(await (await load())('ch1', 'jogos')).toEqual({ ok: false })
    expect(m.updateMock).not.toHaveBeenCalled()
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })
  it('table youtube_niches not in this database yet: the built-in niches still work, a created one is refused', async () => {
    const a = setup({ niches: 'missing' })
    expect(await (await load())('ch1', 'viagem')).toEqual({ ok: true })
    expect(a.updateMock).toHaveBeenCalledWith({ niche: 'viagem' })
    const b = setup({ niches: 'missing' })
    expect(await (await load())('ch1', 'jogos')).toEqual({ ok: false })
    expect(b.updateMock).not.toHaveBeenCalled()
  })
  it('the niches read fails for another reason: refused, nothing written (never "any niche goes")', async () => {
    const m = setup({ niches: 'broken' })
    expect(await (await load())('ch1', 'ia')).toEqual({ ok: false })
    expect(m.updateMock).not.toHaveBeenCalled()
  })
  it('DB error (also: column does not exist yet) -> ok:false, no revalidate', async () => {
    const m = setup({ result: { error: new Error('42703'), data: null } })
    expect(await (await load())('ch1', 'viagem')).toEqual({ ok: false })
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })
  it('a channel id of another site matches zero rows -> ok:false, no revalidate, filtered by site_id', async () => {
    const m = setup({ result: { error: null, data: [] } })
    expect(await (await load())('other-site-ch', 'ia')).toEqual({ ok: false })
    expect(m.secondEqMock).toHaveBeenCalledWith('site_id', 's1')
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })
  it(`success: updates ${table} filtered by id and site_id, then revalidates`, async () => {
    const m = setup()
    expect(await (await load())('ch1', 'ia')).toEqual({ ok: true })
    expect(m.fromMock).toHaveBeenCalledWith(table)
    expect(m.updateMock).toHaveBeenCalledWith({ niche: 'ia' })
    expect(m.firstEqMock).toHaveBeenCalledWith('id', 'ch1')
    expect(m.secondEqMock).toHaveBeenCalledWith('site_id', 's1')
    expect(m.revalidatePathMock).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('null clears the niche without reading the niches', async () => {
    const m = setup()
    expect(await (await load())('ch1', null)).toEqual({ ok: true })
    expect(m.updateMock).toHaveBeenCalledWith({ niche: null })
    expect(m.fromMock).not.toHaveBeenCalledWith('youtube_niches')
  })
})
