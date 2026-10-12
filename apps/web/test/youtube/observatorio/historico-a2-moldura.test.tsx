// @vitest-environment jsdom
// Fase A2, tarefa 3 (A2.6, emenda 25): a moldura do Histórico do vídeo é só a trilha, em todas as origens. A página inteira (servidor +
// moldura + tela) é renderizada com o motor real e as dependências de servidor trocadas por dublês: o que se afirma é o que a pessoa vê.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent, act, waitFor } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { loadOracle, datasetFromOracle } from './oracle'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Dataset } from '@/lib/youtube/observatorio'
import type { ForjaRequest, Niche } from '@/lib/youtube/observatorio/types'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { useForjaRefresh } from '@/app/cms/(authed)/youtube/competitors/_chrome/use-forja-refresh'
import { limparPagerUsado } from '@/app/cms/(authed)/youtube/competitors/_historico/pager-usado'

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: nav.push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace: _replace, prefetch: _prefetch, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))

const site = vi.hoisted(() => ({ obs: null as unknown, savedNiche: 'todos' }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => ({ siteId: 's', now: 0, rows: { settings: null }, obs: site.obs, savedNiche: site.savedNiche, extra: undefined }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', () => ({ loadSwipeRows: async () => [], savedFromRows: () => ({ saved: new Set<string>() }) }))
const ask = vi.hoisted(() => vi.fn())
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: ask, cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))

const oracle = loadOracle()
const fresh = (): Dataset => datasetFromOracle(oracle)
const base = createObservatory(fresh())
site.obs = base
const FULL = SHOWCASE
const CH = base.video(FULL)!.ch
const CANAL = base.channel(CH)!.name
const NOREG = 'paddy-doyle-l0'

async function pagina(id: string, sp: Record<string, string> = {}, o = base) {
  site.obs = o
  const { default: HistoricoPage } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
  return render(await HistoricoPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp) }))
}
const trilha = () => screen.getByRole('navigation', { name: 'Caminho' })
const itens = () => [...trilha().querySelectorAll('li')].map(li => li.textContent)

beforeEach(() => { nav.replace.mockClear(); nav.refresh.mockClear(); ask.mockReset(); ask.mockResolvedValue({ ok: true, reason: null, results: [] }); window.sessionStorage.clear(); limparPagerUsado(); site.savedNiche = 'todos' })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.useRealTimers() })

describe('moldura do Histórico: só a trilha', () => {
  it('a moldura do Histórico tem só a trilha: nenhuma aba de seção, nenhuma barra de nicho, nenhum botão de forja da moldura', async () => {
    for (const sp of [{ from: 'canais', canal: CH }, { from: 'mudancas' }, { from: 'outliers' }, { from: 'insights' }, {}] as Array<Record<string, string>>) {
      const { container, unmount } = await pagina(FULL, sp)
      expect(container.querySelector('[data-obs-chrome], [data-obs-tabs], .obs-ch-head, .obs-ch-nav')).toBeNull()
      expect(container.querySelector('.obs-ch-niche-bar, [data-obs-niche-bar], [data-niche-scroll]')).toBeNull()
      expect(screen.queryByRole('tablist')).toBeNull()
      // nada do cabeçalho da moldura antiga: sincronizar, adicionar canal, menu ⋯, atalho da forja, linha de atualização
      expect(screen.queryByRole('button', { name: 'Sincronizar concorrentes' })).toBeNull()
      expect(container.querySelector('a[title="Adicionar canal"], .obs-ch-forja, .obs-ch-forja-solid, #obs-ch-req-status, [data-ck="forja"]')).toBeNull()
      expect(container.querySelector('.obs-ch-btn')).toBeNull()
      // só a trilha (e a nota de fuso), uma vez
      expect(screen.getAllByRole('navigation', { name: 'Caminho' })).toHaveLength(1)
      expect(container.querySelector('.obs-tr-tz')!.textContent).toBe('Horários em São Paulo')
      // o botão da forja da própria tela continua onde estava
      expect(container.querySelector('.vhead .frow #askForja')).not.toBeNull()
      unmount()
    }
  })

  it('a trilha é "Canais › <canal> › Histórico do vídeo" vindo do canal e "<origem> › <canal> › Histórico do vídeo" nas outras origens', async () => {
    const casos: Array<[Record<string, string>, string]> = [
      [{ from: 'canais', canal: CH }, 'Canais'], [{ from: 'mudancas' }, 'Mudanças'], [{ from: 'outliers' }, 'Outliers'], [{ from: 'insights' }, 'Insights'],
    ]
    for (const [sp, origem] of casos) {
      const { unmount } = await pagina(FULL, sp)
      expect(itens()).toEqual([origem, CANAL, 'Histórico do vídeo'])
      expect(trilha().querySelector('li:last-child')!.getAttribute('aria-current')).toBe('page')
      expect(trilha().querySelectorAll('li:last-child a')).toHaveLength(0)
      // o último item não é link; os dois primeiros são
      expect(trilha().querySelectorAll('a')).toHaveLength(2)
      unmount()
    }
  })

  it('quem chega de Mudanças, de Outliers e de Insights volta pelo primeiro item da trilha, com os filtros de back=', async () => {
    const casos: Array<[string, string, string]> = [['mudancas', '?niche=ia&saved=1&q=abc', 'Mudanças'], ['outliers', '?fmt=shorts&sort=views', 'Outliers'], ['insights', '?niche=ia&fmt=long', 'Insights']]
    for (const [from, back, origem] of casos) {
      const { unmount } = await pagina(FULL, { from, back })
      const primeiro = within(trilha()).getByRole('link', { name: origem })
      const href = primeiro.getAttribute('href')!
      expect(href.endsWith(back)).toBe(true)
      expect(href).toBe(buildHistoricoView(base, FULL, { from, back }).crumbs.href)
      expect(href.startsWith('/cms/youtube/competitors/' + from)).toBe(true)
      unmount()
    }
  })

  it('o pager mora na linha da trilha (mockup aprovado): um só, dentro de .obs-tr-top, fora da raiz da tela; Próximo e a tecla ] continuam valendo e o foco vai ao botão usado', async () => {
    // só vídeos de CONCORRENTE: o vídeo de canal próprio abre a tela do vídeo próprio (A4, Tarefa 11), não o Histórico
    const ids = base.videos.filter(v => v.tracked !== false && !base.channel(v.ch)!.own).slice(0, 3).map(v => v.id)
    const meio = ids[1]!, depois = ids[2]!
    const sp = { from: 'mudancas', ids: ids.join(',') }
    const { container, unmount } = await pagina(meio, sp)
    const todos = container.querySelectorAll('[data-pager]')
    expect(todos).toHaveLength(1)
    const pager = todos[0]!
    expect(pager.closest('.obs-tr-top')).not.toBeNull()
    expect(pager.closest('[data-obs-screen="historico"]')).toBeNull()
    expect(pager.closest('.obs-tr-aside')).not.toBeNull()
    expect(container.querySelector('.pager-row')).toBeNull()
    // a tecla ] com o foco no título faz o que Próximo faz (a tela procura o pager na moldura, não só na raiz)
    const h2 = container.querySelector<HTMLElement>('.vhead h2')!
    h2.focus()
    fireEvent.keyDown(h2, { key: ']' })
    expect(nav.replace).toHaveBeenCalledTimes(1)
    expect(new URL(nav.replace.mock.calls[0]![0] as string, 'http://x').pathname.endsWith('/' + depois)).toBe(true)
    // o clique registra o botão usado; o vídeo seguinte (outra árvore, como no Next) põe o foco nele e o status lê a posição
    fireEvent.click(container.querySelector<HTMLElement>('[data-pager-next]')!)
    unmount()
    const r2 = await pagina(depois, sp)
    await act(async () => { await Promise.resolve() })
    const prev = r2.container.querySelector<HTMLElement>('[data-pager-prev]')!
    // no fim da lista o Próximo some: o foco vai ao outro botão (como a tela sempre fez)
    expect(r2.container.querySelector('[data-pager-next]')).toBeNull()
    expect(document.activeElement).toBe(prev)
    expect(r2.container.querySelector('#hv-live')!.textContent).toMatch(/^Vídeo 3 de 3: /)
  })

  it('vídeo não encontrado: a mesma moldura, a trilha de volta e o cartão "Vídeo não encontrado"', async () => {
    const back = '?fmt=longos&sort=views'
    for (const [sp, esperada] of [
      [{ from: 'canais', canal: CH, back }, ['Canais', CANAL, 'Histórico do vídeo']],
      [{ from: 'mudancas', back: '?niche=ia' }, ['Mudanças', 'Histórico do vídeo']],
    ] as Array<[Record<string, string>, string[]]>) {
      const { container, unmount } = await pagina('video-que-nao-existe', sp)
      expect(itens()).toEqual(esperada)
      expect(container.querySelector('[data-not-found]')!.textContent).toMatch(/^Vídeo não encontrado: “video-que-nao-existe”\./)
      expect(container.querySelector('[data-obs-chrome], [data-obs-tabs], .obs-ch-head')).toBeNull()
      expect(container.querySelector('[data-pager]')).toBeNull()
      const voltar = trilha().querySelector('a')!
      expect(voltar.getAttribute('href')).toBe(buildHistoricoView(base, 'video-que-nao-existe', sp).crumbs.href)
      unmount()
    }
  })

  it('vídeo de outro nicho: sem aviso de "Nicho mudou…" (o nicho aparece só ao lado do canal, no cabeçalho do vídeo)', async () => {
    const v = base.video(NOREG)!
    expect(v.niche).toBe('viagem')
    for (const sp of [{ niche: 'ia' }, { niche: 'ia', from: 'outliers' }, { niche: 'todos' }]) {
      const { container, unmount } = await pagina(NOREG, sp)
      await act(async () => { await Promise.resolve() })
      expect(document.body.textContent).not.toMatch(/Nicho mudou|Este vídeo é do nicho|o paginador continua/)
      expect(screen.queryByRole('region', { name: 'Avisos' })?.textContent ?? '').toBe('')
      expect(container.querySelector('.vhead .chan .niche')!.textContent).toBe('Viagem')
      unmount()
    }
    const view = buildHistoricoView(base, NOREG, { niche: 'ia', nicheParam: 'ia' })
    expect('chromeNiche' in view).toBe(false)
    expect('nicheToast' in view.video!).toBe(false)
  })

  it('os avisos (toasts) da tela continuam funcionando dentro da moldura nova', async () => {
    // A2/Tarefa 8: com leitura pronta o botão do cabeçalho é "Ver a leitura" (só rola); o pedido sai do botão "Pedir leitura à forja", de um vídeo sem leitura
    const ds = fresh(); ds.readings = ds.readings.filter(r => !(r.type === 'leitura-video' && r.target?.video === FULL))
    const { container } = await pagina(FULL, { niche: 'ia' }, createObservatory(ds))
    const botao = container.querySelector<HTMLButtonElement>('#askForja')!
    expect(botao.textContent).toBe('Pedir leitura à forja')
    expect(botao.getAttribute('aria-disabled')).not.toBe('true')
    fireEvent.click(botao)
    expect(await screen.findByText('Pedido enviado à forja')).toBeTruthy()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(within(screen.getByRole('region', { name: 'Avisos' })).getByText('Pedido enviado à forja')).toBeTruthy()
    // e o item do canal da trilha, como sempre, é um link comum
    expect(trilha().querySelectorAll('a')).toHaveLength(2)
  })
})

describe('atualização automática com pedido em andamento (D7)', () => {
  const dbReq = (ds: Dataset, niche: Niche, video: string): ForjaRequest => ({
    id: 'db-leitura-video-' + niche, type: 'leitura-video', niche, status: 'pending', video, target: { kind: 'video', niche, video },
    state: 'na fila', createdAt: ds.now - 4 * 6e4, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
  })
  const Scr = ({ o, video }: { o: typeof base; video: string }) => <ToastProvider><HistoricoScreen view={buildHistoricoView(o, video, { niche: 'ia' })} /></ToastProvider>

  it('com pedido da forja em andamento a tela continua se atualizando sozinha (useForjaRefresh ativo); sem pedido, não', () => {
    vi.useFakeTimers()
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia', FULL))
    const comPedido = createObservatory(ds)
    expect(buildHistoricoView(comPedido, FULL, { niche: 'ia' }).forja?.status?.active).toBe(true)
    expect(buildHistoricoView(base, FULL, { niche: 'ia' }).forja?.status?.active ?? false).toBe(false)
    // com pedido: um refresh por minuto
    const a = render(<Scr o={comPedido} video={FULL} />)
    act(() => { vi.advanceTimersByTime(59_000) })
    expect(nav.refresh).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(120_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(3)
    // o pedido acaba (a tela nova não o traz): para
    a.rerender(<Scr o={base} video={FULL} />)
    nav.refresh.mockClear()
    act(() => { vi.advanceTimersByTime(300_000) })
    expect(nav.refresh).not.toHaveBeenCalled()
    a.unmount()
    // sem pedido desde o começo
    render(<Scr o={base} video={FULL} />)
    act(() => { vi.advanceTimersByTime(300_000) })
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('useForjaRefresh: "paused" suspende, devolve o instante do último refresh e limpa o intervalo ao desmontar', async () => {
    vi.useFakeTimers()
    const { renderHook } = await import('@testing-library/react')
    const hook = renderHook(({ active, paused }: { active: boolean; paused?: boolean }) => useForjaRefresh(active, paused), { initialProps: { active: true, paused: true } })
    act(() => { vi.advanceTimersByTime(180_000) })
    expect(nav.refresh).not.toHaveBeenCalled()
    const antes = hook.result.current.lastAt
    hook.rerender({ active: true, paused: false })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(hook.result.current.lastAt).toBeGreaterThan(antes)
    hook.unmount()
    act(() => { vi.advanceTimersByTime(300_000) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('a leitura que sai de "em andamento" para "publicada" avisa uma vez (o aviso que a moldura antiga dava)', async () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia', FULL))
    const andando = createObservatory(ds)
    const ds2 = fresh(); const pub = dbReq(ds2, 'ia', FULL)
    ds2.requests.push({ ...pub, status: 'completed', state: 'publicado', claimedAt: ds2.now - 3 * 6e4, publishedAt: ds2.now - 6e4 })
    const publicado = createObservatory(ds2)
    const st = buildHistoricoView(publicado, FULL, { niche: 'ia' }).forja?.status
    // pré-condição: o motor devolve o estado "publicado" para este vídeo; se o dataset mudar, o teste falha em vez de passar sem afirmar nada
    expect(st, 'o motor devolve o estado do pedido').toBeTruthy()
    expect(st!.active).toBe(false)
    expect(st!.text).toMatch(/publicad/)
    expect(st!.warn).toBeFalsy()
    const r = render(<Scr o={andando} video={FULL} />)
    r.rerender(<Scr o={publicado} video={FULL} />)
    await waitFor(() => expect(screen.getByText('Leitura publicada')).toBeTruthy())
  })
})
