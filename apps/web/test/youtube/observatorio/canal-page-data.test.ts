// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'

/** O conjunto de um canal, como o carregador o entrega: um canal só, `scope: 'canal'`. */
function oneChannelDataset(): Dataset {
  const { ds, chId } = canalWorld()
  return { ...ds, scope: 'canal', channels: ds.channels.filter(c => c.id === chId), videos: ds.videos.filter(v => v.ch === chId) }
}

const O1 = '00000000-0000-4000-8000-000000000001', O2 = '00000000-0000-4000-8000-000000000002'
const DIA = 86_400_000
/** `ultimo` relativo ao relógio real: o `now` da página é `Date.now()` fora do e2e. */
const DUAS_LINHAS = () => [{ id: O1, name: 'tnFigueiredo', subs: 1160, videos: 35, ultimo: Date.now() - 3 * DIA - 3_600_000 }, { id: O2, name: 'Thiago Figueiredo', subs: 3, videos: 0, ultimo: null }]
type Linhas = ReturnType<typeof DUAS_LINHAS>

async function setup(o: { access?: { ok: true; user: { id: string } } | { ok: false; reason: string }; editOk?: boolean; ds?: Dataset | null; loadError?: Error; ownRows?: Linhas; ownError?: Error; cookie?: string | null | 'lança'; editThrows?: Error; realLoader?: boolean } = {}) {
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
    if (opts.mode === 'edit' && o.editThrows) throw o.editThrows
    if (opts.mode === 'edit') return o.editOk === false ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: 'u1' } }
    return o.access ?? { ok: true, user: { id: 'u1' } }
  })
  const loadOwnMenuRows = vi.fn(async (_siteId: string) => {
    order.push('own')
    if (o.ownError) throw o.ownError
    return o.ownRows ?? DUAS_LINHAS()
  })
  vi.doMock('next/headers', () => ({
    cookies: async () => {
      if (o.cookie === 'lança') throw new Error('fora de um pedido')
      return { get: (n: string) => (n === 'obs-meu-canal' && o.cookie != null ? { name: n, value: o.cookie } : undefined) }
    },
  }))
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/youtube/observatorio/own-menu', () => ({ loadOwnMenuRows }))
  vi.doMock('@sentry/nextjs', () => ({ captureException }))
  vi.doMock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT ' + url) } }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope }))
  if (!o.realLoader) vi.doMock('@/lib/youtube/observatorio/load-page', () => ({ loadChannelDataset, loadPageRows: vi.fn() }))
  // o carregador de verdade com um banco que diz "uuid inválido" (22P02) e anota toda tabela consultada
  const tabelas: string[] = []
  const cadeia = { select: () => cadeia, eq: () => cadeia, maybeSingle: async () => ({ data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }) }
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { order.push('service'); return o.realLoader ? { from: (t: string) => { tabelas.push(t); return cadeia } } : {} } }))
  const { openChannelPage } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/page-data')
  return { openChannelPage, loadChannelDataset, loadOwnMenuRows, requireSiteScope, captureException, order, tabelas }
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
    expect(page.owns.itens.map(i => [i.id, i.nota, i.href != null])).toEqual([[O1, 'último vídeo há 3 dias, 1,16 mil inscritos', true], [O2, 'sem vídeos, 3 inscritos: ainda sem página', false]])
    expect(page.owns.principal!.id).toBe(O1)
    expect(page.owns.listaHref).toBe('/cms/youtube/competitors')
  })
  describe('a escolha do dono para "o meu canal" (cookie obs-meu-canal, 11c)', () => {
    const DOIS_ATIVOS = (): Linhas => [{ id: O1, name: 'Grande', subs: 900, videos: 20, ultimo: Date.now() - 30 * DIA }, { id: O2, name: 'Pequeno', subs: 10, videos: 5, ultimo: Date.now() - 2 * DIA }]
    it('sem o cookie (apagado): vale a recência; meuCanalLembrado é null', async () => {
      const { openChannelPage } = await setup({ ownRows: DOIS_ATIVOS(), cookie: null })
      const page = await openChannelPage('matt-wolfe')
      expect(page.meuCanalLembrado).toBeNull()
      expect(page.owns.principal!.id).toBe(O2)
    })
    it('com o cookie de um canal próprio com vídeos: a escolha vale e chega em meuCanalLembrado', async () => {
      const { openChannelPage } = await setup({ ownRows: DOIS_ATIVOS(), cookie: O1 })
      const page = await openChannelPage('matt-wolfe')
      expect(page.meuCanalLembrado).toBe(O1)
      expect(page.owns.principal!.id).toBe(O1)
    })
    it('valor ruim (lixo, vazio, de canal que não é próprio ou removido) é ignorado sem erro', async () => {
      for (const cookie of ['lixo', '', '<script>', '00000000-0000-4000-8000-0000000000ff']) {
        const { openChannelPage } = await setup({ ownRows: DOIS_ATIVOS(), cookie })
        const page = await openChannelPage('matt-wolfe')
        expect(page.owns.principal!.id, cookie).toBe(O2)
      }
    })
    it('cookies() que lança (fora de um pedido) não derruba a página: sem escolha', async () => {
      const { openChannelPage } = await setup({ ownRows: DOIS_ATIVOS(), cookie: 'lança' })
      const page = await openChannelPage('matt-wolfe')
      expect(page.meuCanalLembrado).toBeNull()
      expect(page.owns.principal!.id).toBe(O2)
    })
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

  describe('o dado privado do canal próprio (Tarefa 4 da A4)', () => {
    it('edicao é o token da guarda de edição (a mesma chamada que dá canEdit; uma só); sem permissão de edição é null', async () => {
      const sim = await setup()
      const { EdicaoDoSite } = await import('@/lib/youtube/observatorio/proprio/edicao') // depois do setup: o mesmo grafo de módulos
      const a = await sim.openChannelPage('c1')
      expect(a.edicao).toBeInstanceOf(EdicaoDoSite)
      expect(a.edicao!.siteId).toBe('site-1')
      expect(a.canEdit).toBe(true)
      expect(sim.requireSiteScope.mock.calls.filter(c => (c[0] as { mode: string }).mode === 'edit')).toHaveLength(1)
      const nao = await (await setup({ editOk: false })).openChannelPage('c1')
      expect(nao.edicao).toBeNull(); expect(nao.canEdit).toBe(false)
    })
    it('a guarda de edição lançou: a página abre sem o dado privado (edicao null, canEdit false) e o erro vai ao Sentry; nunca derruba a página', async () => {
      const { openChannelPage, captureException } = await setup({ editThrows: new Error('auth fora do ar') })
      const page = await openChannelPage('c1')
      expect(page.edicao).toBeNull(); expect(page.canEdit).toBe(false)
      expect(page.obs).not.toBeNull()
      expect(captureException).toHaveBeenCalledTimes(1)
    })
    it('acesso negado à leitura: redireciona antes de provar a edição', async () => {
      const { openChannelPage, requireSiteScope } = await setup({ access: { ok: false, reason: 'unauthenticated' } })
      await expect(openChannelPage('c1')).rejects.toThrow('REDIRECT')
      expect(requireSiteScope.mock.calls.every(c => (c[0] as { mode: string }).mode === 'view')).toBe(true)
    })
    it('ownYtIds: os longos acompanhados do canal próprio, do mais novo ao mais antigo; canal de concorrente dá []', async () => {
      const proprio = oneChannelDataset()
      proprio.channels[0]!.own = true
      const id = proprio.channels[0]!.id
      const esperado = proprio.videos.filter(v => v.tracked && v.fmt === 'long').sort((a, b) => b.pub - a.pub).map(v => v.ytId)
      expect(esperado.length).toBeGreaterThan(0)
      expect((await (await setup({ ds: proprio })).openChannelPage(id)).ownYtIds).toEqual(esperado)
      expect((await (await setup()).openChannelPage(id)).ownYtIds).toEqual([])
    })
    it('canal não encontrado: ownYtIds vazio', async () => {
      expect((await (await setup({ ds: null })).openChannelPage('nao-existe')).ownYtIds).toEqual([])
    })
    it('id malformado na URL dá o MESMO "não encontrado" de um id inexistente, no carregador de verdade, sem chegar às tabelas privadas', async () => {
      const inexistente = await (await setup({ ds: null })).openChannelPage('3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10')
      for (const id of ['lixo', '<script>', "x'; drop table", '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a1', 'a'.repeat(300)]) {
        const sim = await setup({ realLoader: true })
        const page = await sim.openChannelPage(id)
        expect(page.obs, id).toBeNull()
        expect(page.ownYtIds, id).toEqual([])
        expect(page.obs).toEqual(inexistente.obs)
        expect(sim.captureException).not.toHaveBeenCalled()
        expect(sim.tabelas.every(t => t === 'competitor_channels'), id).toBe(true)
      }
    })
  })
})
