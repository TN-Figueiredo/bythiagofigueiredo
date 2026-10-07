// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const EMPTY = { settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null }
async function setup(o: { access?: { ok: true; user: { id: string } } | { ok: false; reason: string }; pref?: unknown; prefError?: boolean; loadError?: Error } = {}) {
  vi.resetModules()
  const order: string[] = []
  const loadPageRows = vi.fn(async (_siteId: string, _now: number) => { order.push('load'); if (o.loadError) throw o.loadError; return EMPTY })
  const prefEq = vi.fn()
  vi.doMock('server-only', () => ({}))
  vi.doMock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT ' + url) } }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async (opts: unknown) => { order.push('guard ' + JSON.stringify(opts)); return o.access ?? { ok: true, user: { id: 'u1' } } }) }))
  vi.doMock('@/lib/youtube/observatorio/load-page', () => ({ loadPageRows }))
  const prefResult = o.prefError ? { data: null, error: { code: '57014', message: 'timeout' } } : { data: o.pref === undefined ? null : { niche: o.pref }, error: null }
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('service'); return { from: (t: string) => ({ select: () => ({ eq: (c: string, v: string) => { prefEq(t, c, v); return { eq: (c2: string, v2: string) => { prefEq(t, c2, v2); return { maybeSingle: async () => { order.push('pref'); return prefResult } } } } } }) }) } } }))
  const { openObservatoryPage } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/page-data')
  return { openObservatoryPage, loadPageRows, prefEq, order }
}

describe('openObservatoryPage', () => {
  it('sem sessão: redireciona para o login e não lê nada com a chave de serviço', async () => {
    const { openObservatoryPage, loadPageRows, order } = await setup({ access: { ok: false, reason: 'unauthenticated' } })
    await expect(openObservatoryPage()).rejects.toThrow('REDIRECT /cms/login')
    expect(loadPageRows).not.toHaveBeenCalled()
    expect(order.filter(x => x === 'load' || x === 'pref' || x === 'service')).toEqual([])
  })
  it('sem acesso ao site: redireciona e não lê nada, nem a leitura extra', async () => {
    const { openObservatoryPage, loadPageRows, order } = await setup({ access: { ok: false, reason: 'insufficient_access' } })
    const extra = vi.fn(async () => 1)
    await expect(openObservatoryPage(extra)).rejects.toThrow('REDIRECT /?error=insufficient_access')
    expect(loadPageRows).not.toHaveBeenCalled()
    expect(extra).not.toHaveBeenCalled()
    expect(order.filter(x => x === 'service')).toEqual([])
  })
  it('com acesso: o guard de leitura vem antes de toda leitura, com o site do contexto', async () => {
    const { openObservatoryPage, loadPageRows, order } = await setup()
    const page = await openObservatoryPage()
    expect(order[0]).toBe('guard {"area":"cms","siteId":"site-1","mode":"view"}')
    expect(loadPageRows).toHaveBeenCalledTimes(1)
    expect(loadPageRows.mock.calls[0]![0]).toBe('site-1')
    expect(page.siteId).toBe('site-1')
    expect(page.obs.tabCounts('todos')).toEqual({ canais: 0, mud: 0, out: 0 })
  })
  it('o conjunto é montado com o mesmo now passado ao carregador', async () => {
    const { openObservatoryPage, loadPageRows } = await setup()
    const page = await openObservatoryPage()
    expect(loadPageRows.mock.calls[0]![1]).toBe(page.now)
    expect(page.obs.NOW).toBe(page.now)
  })
  it('nicho salvo: sem linha → todos; valor inválido → todos; leitura falhou → todos; válido → ele; lido do usuário e do site do guard', async () => {
    expect((await (await setup()).openObservatoryPage()).savedNiche).toBe('todos')
    expect((await (await setup({ pref: 'Não É Slug!' })).openObservatoryPage()).savedNiche).toBe('todos')
    expect((await (await setup({ prefError: true })).openObservatoryPage()).savedNiche).toBe('todos')
    const ok = await setup({ pref: 'viagem' })
    expect((await ok.openObservatoryPage()).savedNiche).toBe('viagem')
    expect(ok.prefEq.mock.calls).toEqual([['competitor_user_prefs', 'user_id', 'u1'], ['competitor_user_prefs', 'site_id', 'site-1']])
  })
  it('a carga falhou: o erro sobe (a tela mostra o erro), nunca um Observatório vazio', async () => {
    const { openObservatoryPage } = await setup({ loadError: new Error('observatório: falha ao ler competitor_videos: boom') })
    await expect(openObservatoryPage()).rejects.toThrow(/competitor_videos/)
  })
  it('a leitura extra recebe o site do contexto e volta em extra', async () => {
    const { openObservatoryPage } = await setup()
    const extra = vi.fn(async (siteId: string) => 'extra de ' + siteId)
    expect((await openObservatoryPage(extra)).extra).toBe('extra de site-1')
  })
})
