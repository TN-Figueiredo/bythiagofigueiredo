// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'

/** O conjunto de um canal, como o carregador o entrega: um canal só, `scope: 'canal'`. */
function oneChannelDataset(): Dataset {
  const { ds, chId } = canalWorld()
  return { ...ds, scope: 'canal', channels: ds.channels.filter(c => c.id === chId), videos: ds.videos.filter(v => v.ch === chId) }
}

const DUAS_LINHAS = [{ id: 'o1', name: 'tnFigueiredo', subs: 1160, videos: 35 }, { id: 'o2', name: 'Thiago Figueiredo', subs: 3, videos: 0 }]

async function setup(o: { access?: { ok: true; user: { id: string } } | { ok: false; reason: string }; editOk?: boolean; ds?: Dataset | null; loadError?: Error; ownRows?: typeof DUAS_LINHAS; ownError?: Error } = {}) {
  vi.resetModules()
  const order: string[] = []
  const loadChannelDataset = vi.fn(async (_siteId: string, _channelId: string, _now: number) => {
    order.push('load')
    if (o.loadError) throw o.loadError
    return o.ds === undefined ? oneChannelDataset() : o.ds
  })
  const captureException = vi.fn()
  const requireSiteScope = vi.fn(async (opts: { mode: string }) => {
    order.push('guard ' + opts.mode)
    if (opts.mode === 'edit') return o.editOk === false ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: 'u1' } }
    return o.access ?? { ok: true, user: { id: 'u1' } }
  })
  const loadOwnMenuRows = vi.fn(async (_siteId: string) => {
    order.push('own')
    if (o.ownError) throw o.ownError
    return o.ownRows ?? DUAS_LINHAS
  })
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/youtube/observatorio/own-menu', () => ({ loadOwnMenuRows }))
  vi.doMock('@sentry/nextjs', () => ({ captureException }))
  vi.doMock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT ' + url) } }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope }))
  vi.doMock('@/lib/youtube/observatorio/load-page', () => ({ loadChannelDataset, loadPageRows: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('service'); return {} } }))
  const { openChannelPage } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/page-data')
  return { openChannelPage, loadChannelDataset, loadOwnMenuRows, requireSiteScope, captureException, order }
}

describe('openChannelPage', () => {
  it('acesso negado: redireciona e NÃO lê o canal', async () => {
    const { openChannelPage, loadChannelDataset, order } = await setup({ access: { ok: false, reason: 'unauthenticated' } })
    await expect(openChannelPage('c1')).rejects.toThrow('REDIRECT /cms/login')
    expect(loadChannelDataset).toHaveBeenCalledTimes(0)
    expect(order.filter(x => x === 'load' || x === 'service')).toEqual([])
  })
  it('sem acesso ao site: redireciona para o erro e NÃO lê o canal', async () => {
    const { openChannelPage, loadChannelDataset } = await setup({ access: { ok: false, reason: 'insufficient_access' } })
    await expect(openChannelPage('c1')).rejects.toThrow('REDIRECT /?error=insufficient_access')
    expect(loadChannelDataset).toHaveBeenCalledTimes(0)
  })
  it('id de outro site ou inventado: obs null, sem leitura pesada', async () => {
    const { openChannelPage, loadChannelDataset, captureException } = await setup({ ds: null })
    const page = await openChannelPage('nao-existe')
    expect(page.obs).toBeNull()
    expect(page.siteId).toBe('site-1')
    expect(loadChannelDataset).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledTimes(0)
  })
  it('canal do site: devolve o motor do conjunto de um canal', async () => {
    const { openChannelPage } = await setup()
    const page = await openChannelPage('matt-wolfe')
    expect(page.obs).not.toBeNull()
    expect(page.obs!.channels.length).toBe(1)
    expect(page.obs!.channel('matt-wolfe')).toBeDefined()
  })
  it('siteId vem do contexto do site, nunca da URL; o id da URL só diz qual canal', async () => {
    const { openChannelPage, loadChannelDataset } = await setup()
    const page = await openChannelPage('matt-wolfe')
    expect(loadChannelDataset.mock.calls[0]![0]).toBe('site-1')
    expect(loadChannelDataset.mock.calls[0]![1]).toBe('matt-wolfe')
    expect(loadChannelDataset.mock.calls[0]![2]).toBe(page.now)
  })
  it('o guard de leitura vem antes de toda leitura; canEdit é o resultado do guard de edição', async () => {
    const yes = await setup()
    const a = await yes.openChannelPage('c1')
    expect(yes.order[0]).toBe('guard view')
    expect(a.canEdit).toBe(true)
    expect(yes.requireSiteScope.mock.calls.some(c => (c[0] as { mode: string }).mode === 'edit')).toBe(true)
    const no = await setup({ editOk: false })
    expect((await no.openChannelPage('c1')).canEdit).toBe(false)
  })
  it('a carga falhou: o erro sobe (a tela mostra o erro), nunca "canal não encontrado"', async () => {
    const { openChannelPage } = await setup({ loadError: new Error('observatório: falha ao ler competitor_videos: boom') })
    await expect(openChannelPage('c1')).rejects.toThrow(/competitor_videos/)
  })

  it('os canais próprios do atalho "Meu canal" vêm da leitura leve (o conjunto de um canal lança em ownChannels), na ordem do motor, com a nota', async () => {
    const { openChannelPage, loadOwnMenuRows } = await setup()
    const page = await openChannelPage('matt-wolfe')
    expect(loadOwnMenuRows).toHaveBeenCalledTimes(1)
    expect(loadOwnMenuRows.mock.calls[0]![0]).toBe('site-1') // do contexto do site, nunca da URL
    expect(page.owns.itens.map(i => [i.id, i.nota, i.href != null])).toEqual([['o1', '35 vídeos, 1,16 mil inscritos', true], ['o2', 'sem vídeos, 3 inscritos: ainda sem página', false]])
    expect(page.owns.principal!.id).toBe('o1')
    expect(page.owns.listaHref).toBe('/cms/youtube/competitors')
  })
  it('canal não encontrado também traz os canais próprios (a moldura do "Canal não encontrado" tem o atalho)', async () => {
    const { openChannelPage } = await setup({ ds: null })
    const page = await openChannelPage('nao-existe')
    expect(page.obs).toBeNull()
    expect(page.owns.itens).toHaveLength(2)
  })
  it('site sem canal próprio: itens vazios e nenhum principal', async () => {
    const { openChannelPage } = await setup({ ownRows: [] })
    const page = await openChannelPage('matt-wolfe')
    expect(page.owns.itens).toEqual([])
    expect(page.owns.principal).toBeNull()
  })
  it('a leitura dos canais próprios roda EM PARALELO com a do canal, depois da guarda de acesso', async () => {
    const { openChannelPage, order } = await setup()
    await openChannelPage('matt-wolfe')
    const iView = order.indexOf('guard view'), iOwn = order.indexOf('own'), iLoad = order.indexOf('load')
    expect(iView).toBe(0)
    expect(iOwn).toBeGreaterThan(iView); expect(iLoad).toBeGreaterThan(iView)
    // as duas começaram antes de qualquer uma terminar: nenhuma leitura espera a outra
    expect(Math.abs(iOwn - iLoad)).toBeLessThanOrEqual(2)
  })
  it('acesso negado: os canais próprios NÃO são lidos', async () => {
    const { openChannelPage, loadOwnMenuRows } = await setup({ access: { ok: false, reason: 'unauthenticated' } })
    await expect(openChannelPage('c1')).rejects.toThrow('REDIRECT')
    expect(loadOwnMenuRows).toHaveBeenCalledTimes(0)
  })
  it('erro ao ler os canais próprios sobe (nunca uma lista vazia que esconderia o atalho em silêncio)', async () => {
    const { openChannelPage } = await setup({ ownError: new Error('observatório: falha ao ler youtube_channels: boom') })
    await expect(openChannelPage('matt-wolfe')).rejects.toThrow(/youtube_channels/)
  })
})
