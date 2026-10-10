// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { mountCanal } from './canal-mount'
import { canalWorld } from './canal-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
  redirect: vi.fn(),
}))

// A página (Server Component) é chamada como função: o que ela lê e o que entrega a CanalScreen é o que se afirma.
const mocks = vi.hoisted(() => ({ openChannelPage: vi.fn(), openObservatoryPage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => mocks)
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))

import CanalPage from '@/app/cms/(authed)/youtube/competitors/canal/[id]/page'

const URL0 = '/cms/youtube/competitors/canal/matt-wolfe'
const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s ]+/g, ' ').trim()
type Mut = (ds: Dataset, id: string) => void
const semNicho: Mut = (ds, id) => { ds.channels.find(c => c.id === id)!.niche = null }
const semLeitura: Mut = ds => { ds.readings = []; ds.requests = [] }

/** Roda a página de verdade (mocks só nas leituras) e devolve o nó `leitura` que ela entrega a CanalScreen. */
async function paginaLeitura(mut?: Mut, tab = 'leitura'): Promise<ReactNode> {
  const { obs, chId } = canalWorld(mut)
  mocks.openChannelPage.mockResolvedValue({ siteId: 's1', now: 0, obs, canEdit: true })
  mocks.openObservatoryPage.mockResolvedValue({ siteId: 's1', now: 0, obs, rows: {}, savedNiche: 'todos', extra: undefined })
  const el = (await CanalPage({ params: Promise.resolve({ id: chId }), searchParams: Promise.resolve({ tab }) })) as ReactElement<{ children: ReactElement<{ leitura: ReactNode }> }>
  return el.props.children.props.leitura
}
async function montaLeitura(mut?: Mut) {
  const leitura = await paginaLeitura(mut)
  return mountCanal({ mut, sp: { tab: 'leitura' }, leitura })
}

beforeEach(() => {
  push.mockReset(); replace.mockReset(); refresh.mockReset(); mocks.openChannelPage.mockReset(); mocks.openObservatoryPage.mockReset()
  window.history.replaceState(null, '', URL0)
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('aba Leitura: a moldura', () => {
  it('o rótulo diz "Leitura do nicho <nicho> (não é só deste canal)"', async () => {
    const { view } = await montaLeitura()
    expect(view.header.nicheLabel).toBe('IA')
    expect(screen.getByRole('heading', { level: 3, name: 'Leitura do nicho IA (não é só deste canal)' })).toBeTruthy()
  })

  it('a região é role=region rotulada "Leitura da forja"', async () => {
    await montaLeitura()
    const reg = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(within(reg).getByRole('heading', { level: 2, name: 'Leitura' })).toBeTruthy()
    expect(within(reg).getByRole('button', { name: 'Pedir leitura deste canal à forja' })).toBeTruthy()
  })

  it('o botão do canal está apagado: aria-disabled, rótulo "Pedir leitura deste canal à forja"', async () => {
    await montaLeitura()
    const b = screen.getByRole('button', { name: 'Pedir leitura deste canal à forja' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(false)   // aria-disabled mantém o botão no foco e no leitor de tela
  })

  it('sob o botão: "Leitura por canal ainda não existe. Por enquanto, a leitura do nicho IA está logo abaixo."', async () => {
    await montaLeitura()
    const b = screen.getByRole('button', { name: 'Pedir leitura deste canal à forja' })
    const frase = 'Leitura por canal ainda não existe. Por enquanto, a leitura do nicho IA está logo abaixo.'
    expect(screen.getByText(frase)).toBeTruthy()
    expect(norm(document.getElementById(b.getAttribute('aria-describedby')!)?.textContent)).toBe(frase)
  })

  it('clicar no botão apagado não chama nada', async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const { act } = await montaLeitura()
    const b = screen.getByRole('button', { name: 'Pedir leitura deste canal à forja' })
    const url0 = window.location.pathname + window.location.search
    await userEvent.setup().click(b)
    fireEvent.keyDown(b, { key: 'Enter' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled(); expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
    for (const f of Object.values(act)) expect(f).not.toHaveBeenCalled()
    expect(screen.queryByText(/Pedido enviado|Pedido não enviado/)).toBeNull()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(window.location.pathname + window.location.search).toBe(url0)
  })

  it('o cartão da leitura do nicho é o de Mudanças, sem botão de pedir', async () => {
    await montaLeitura()
    const reg = screen.getByRole('region', { name: 'Leitura da forja' })
    const tela = reg.querySelector('[data-obs-screen="mudancas"]')!
    expect(tela).not.toBeNull()
    expect(within(tela as HTMLElement).getByText('IA', { selector: 'summary b' })).toBeTruthy()
    expect(within(tela as HTMLElement).queryByRole('button', { name: /Pedir|Confirmar pedido/ })).toBeNull()
    // o único botão de pedido da região é o apagado do canal
    expect(within(reg).getAllByRole('button', { name: /Pedir/ })).toHaveLength(1)
  })

  it('nicho sem leitura publicada: a frase de vazio do cartão de Mudanças, sem botão de pedir', async () => {
    await montaLeitura(semLeitura)
    const reg = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(within(reg).getByText(/Ainda não há leitura de resumo das trocas de IA\./)).toBeTruthy()
    expect(reg.querySelector('details.fj-niche')).toBeNull()
    expect(within(reg).getAllByRole('button', { name: /Pedir/ })).toHaveLength(1)   // só o do canal, apagado
  })

  it('canal sem nicho: "Escolha o nicho do canal para ver a leitura do nicho." e nenhum cartão', async () => {
    await montaLeitura(semNicho)
    const reg = screen.getByRole('region', { name: 'Leitura da forja' })
    expect(within(reg).getByText('Escolha o nicho do canal para ver a leitura do nicho.')).toBeTruthy()
    expect(reg.querySelector('[data-obs-screen="mudancas"]')).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByRole('button', { name: /Pedir/ })).toBeNull()
  })
})

describe('a página: só a aba Leitura lê o conjunto do site', () => {
  it('nas abas Vídeos e Trocas o conjunto do site não é lido e o nó leitura é nulo', async () => {
    for (const tab of ['videos', 'trocas']) {
      mocks.openObservatoryPage.mockClear()
      expect(await paginaLeitura(undefined, tab)).toBeNull()
      expect(mocks.openObservatoryPage).not.toHaveBeenCalled()
    }
  })

  it('na aba Leitura com nicho, lê o conjunto do site uma vez', async () => {
    expect(await paginaLeitura()).not.toBeNull()
    expect(mocks.openObservatoryPage).toHaveBeenCalledTimes(1)
  })

  it('na aba Leitura sem nicho, não lê o conjunto do site (não há o que ler)', async () => {
    expect(await paginaLeitura(semNicho)).not.toBeNull()
    expect(mocks.openObservatoryPage).not.toHaveBeenCalled()
  })
})

describe('as abas: Leitura é navegação de verdade', () => {
  const aba = (nome: RegExp) => within(screen.getByRole('navigation', { name: 'Seções do canal' })).getByRole('link', { name: nome })
  /** Clica e diz se o navegador seguiria o link (ninguém chamou preventDefault); o jsdom não navega, então o clique é contido aqui. */
  const clica = (a: HTMLElement) => {
    let segue = false
    const h = (e: Event) => { segue = !e.defaultPrevented; e.preventDefault() }
    document.addEventListener('click', h)
    try { fireEvent.click(a) } finally { document.removeEventListener('click', h) }
    return segue
  }

  it('a nav tem Vídeos, Trocas e Leitura, nesta ordem, e não tem Retenção', () => {
    mountCanal()
    const links = within(screen.getByRole('navigation', { name: 'Seções do canal' })).getAllByRole('link')
    expect(links.map(l => norm(l.textContent).replace(/ \d.*$/, ''))).toEqual(['Vídeos', 'Trocas', 'Leitura'])
    expect(screen.queryByText(/Retenção/)).toBeNull()
  })

  it('o link Leitura vai para link.canal(id, { tab: "leitura" }) e o clique não troca a aba no navegador', async () => {
    const { chId } = mountCanal()
    const a = aba(/^Leitura/)
    expect(a.getAttribute('href')).toBe(link.canal(chId, { tab: 'leitura' }))
    const antes = window.history.length
    expect(clica(a)).toBe(true)                                    // o navegador segue o link
    expect(window.history.length).toBe(antes)                      // nada de pushState
    expect(window.location.search).toBe('')
    expect(document.querySelector('.cv-ctl')).not.toBeNull()       // continua na aba Vídeos até o servidor responder
  })

  it('vista a partir da Leitura: Vídeos e Trocas também são links de navegação, e Leitura é a aba atual', async () => {
    const leitura = await paginaLeitura()
    const { chId } = mountCanal({ sp: { tab: 'leitura' }, leitura })
    expect(aba(/^Leitura/).getAttribute('aria-current')).toBe('page')
    expect(aba(/^Vídeos/).hasAttribute('aria-current')).toBe(false)
    expect(aba(/^Vídeos/).getAttribute('href')).toBe(link.canal(chId, { tab: 'videos' }))
    expect(aba(/^Trocas/).getAttribute('href')).toBe(link.canal(chId, { tab: 'trocas' }))
    window.history.replaceState(null, '', URL0 + '?tab=leitura')
    const antes = window.history.length
    expect(clica(aba(/^Vídeos/))).toBe(true); expect(clica(aba(/^Trocas/))).toBe(true)
    expect(window.history.length).toBe(antes)
    expect(window.location.search).toBe('?tab=leitura')
    expect(document.querySelector('.cv-ctl')).toBeNull()          // a aba Vídeos só monta depois da navegação
    expect(document.querySelector('.ct-list')).toBeNull()
  })

  it('controle: a partir de Vídeos, Trocas continua trocando no navegador (pushState, sem seguir o link)', () => {
    mountCanal()
    const antes = window.history.length
    expect(clica(aba(/^Trocas/))).toBe(false)
    expect(window.history.length).toBe(antes + 1)
    expect(window.location.search).toBe('?tab=trocas')
  })

  it('os links das abas levam a origem (from/back) junto', () => {
    const { chId } = mountCanal({ sp: { from: 'outliers', back: '?niche=ia' } })
    expect(aba(/^Leitura/).getAttribute('href')).toBe(link.canal(chId, { tab: 'leitura', from: 'outliers', back: '?niche=ia' }))
    expect(aba(/^Trocas/).getAttribute('href')).toBe(link.canal(chId, { tab: 'trocas', from: 'outliers', back: '?niche=ia' }))
  })

  it('nas abas Vídeos e Trocas a seção Leitura não é montada, mesmo com o nó pronto', async () => {
    const leitura = await paginaLeitura()
    mountCanal({ leitura })
    expect(screen.queryByRole('region', { name: 'Leitura da forja' })).toBeNull()
    cleanup()
    mountCanal({ leitura, sp: { tab: 'trocas' } })
    expect(screen.queryByRole('region', { name: 'Leitura da forja' })).toBeNull()
  })
})

describe('aba Leitura: o estado do cliente acompanha a navegação do servidor', () => {
  const NO = <p data-testid="no-leitura">conteúdo da leitura</p>
  const abaSel = () => screen.getByRole('navigation', { name: 'Seções do canal' }).querySelector('[aria-current="page"]')?.textContent ?? ''

  async function reMonta(sp: Record<string, string>, leitura: ReactNode, rerender: (ui: ReactElement) => void, m: Awaited<ReturnType<typeof mountCanal>>) {
    const { buildCanalView } = await import('@/app/cms/(authed)/youtube/competitors/_canal/view-model')
    const { CanalScreen } = await import('@/app/cms/(authed)/youtube/competitors/_canal/canal-screen')
    const { nicheOptions } = await import('@/app/cms/(authed)/youtube/competitors/_canais/view-model')
    const { ToastProvider } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/toasts')
    const view = buildCanalView(m.obs, m.chId, sp)!
    rerender(<ToastProvider><div data-obs=""><CanalScreen view={view} niches={nicheOptions(m.obs)} canAdmin leitura={leitura} actions={m.act} /></div></ToastProvider>)
  }

  it('de videos para leitura (Link): a tela mostra a Leitura e marca a aba', async () => {
    const m = mountCanal()
    expect(screen.queryByTestId('no-leitura')).toBeNull()
    await reMonta({ tab: 'leitura' }, NO, m.rerender, m)
    expect(screen.getByTestId('no-leitura')).toBeTruthy()
    expect(abaSel()).toMatch(/Leitura/)
  })

  it('de leitura para videos (Link): a grade volta', async () => {
    const m = mountCanal({ sp: { tab: 'leitura' }, leitura: NO })
    expect(screen.getByTestId('no-leitura')).toBeTruthy()
    await reMonta({}, null, m.rerender, m)
    expect(screen.queryByTestId('no-leitura')).toBeNull()
    expect(document.querySelector('ul.cv-grid')).toBeTruthy()
    expect(abaSel()).toMatch(/Vídeos/)
  })

  it('o mesmo view.state por valor (objeto novo) não desfaz o que o usuário mudou no cliente', async () => {
    const m = mountCanal()
    await userEvent.click(screen.getByRole('link', { name: /^Trocas/ }))
    expect(abaSel()).toMatch(/Trocas/)
    await reMonta({}, null, m.rerender, m)
    expect(abaSel()).toMatch(/Trocas/)
  })

  it('montagem com a URL divergente do estado inicial segue a URL', async () => {
    mountCanal({ urlSearch: '?tab=trocas' })
    expect(abaSel()).toMatch(/Trocas/)
  })
})
