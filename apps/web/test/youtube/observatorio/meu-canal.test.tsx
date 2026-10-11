// @vitest-environment jsdom
// A3 Tarefa 10: o atalho "Meu canal" (spec 15.2): botão com menu na camada flutuante, na moldura do Observatório (grupo de ações) e na da trilha.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { MeuCanal } from '@/app/cms/(authed)/youtube/competitors/_chrome/meu-canal'
import { TrailChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { buildChromeView, type ChromeTab } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { ownMenuOf, type OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { ownChannelHref } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-channels'
import { link } from '@/lib/youtube/observatorio/links'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

const mundo = a3World()
const doisComVideos = ownMenuOf(mundo.obs)
const umSemVideos = ownMenuOf(a3World(ds => {
  const second = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))[1]!
  ds.videos = ds.videos.filter(v => v.ch !== second.id); second.subs = 3
}).obs)
const vazio: OwnMenu = { itens: [], principal: null, listaHref: link.canais() }
const flut = () => document.getElementById('flut')
const menu = () => within(flut()!).getByRole('menu', { name: 'Meus canais' })

beforeEach(() => { siteAdmin.value = true })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

describe('MeuCanal', () => {
  it('o botão diz "Meu canal: <nome>" com aria-haspopup e aria-expanded; sem canal próprio o componente não existe', () => {
    const { container, rerender } = render(<MeuCanal owns={doisComVideos} />)
    const b = screen.getByRole('button', { name: `Meu canal: ${doisComVideos.principal!.name}` })
    expect(b.getAttribute('aria-haspopup')).toBe('menu')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    rerender(<MeuCanal owns={vazio} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('com UM canal próprio continua sendo um menu (o canal e "Ver meus canais na lista de Canais")', async () => {
    const um = ownMenuOf(a3World(undefined, '1').obs)
    render(<MeuCanal owns={um} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^Meu canal:/ }))
    expect(within(menu()).getAllByRole('menuitem')).toHaveLength(2)
  })
  it('abre na camada flutuante: título "Meus canais", um link por canal com vídeos, o sem vídeos apagado com "ainda sem página", e "Ver meus canais na lista de Canais"', async () => {
    const user = userEvent.setup()
    const { container } = render(<MeuCanal owns={umSemVideos} />)
    const b = screen.getByRole('button', { name: /^Meu canal:/ })
    await user.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[role="menu"]'), 'o menu mora em #flut, nunca dentro do botão ou da trilha').toBeNull()
    const m = menu()
    expect(flut()!.contains(m)).toBe(true)
    expect(within(m).getByText('Meus canais')).toBeTruthy()
    const [com, sem] = [umSemVideos.itens.find(i => i.href)!, umSemVideos.itens.find(i => !i.href)!]
    const l = within(m).getAllByRole('menuitem').find(i => i.getAttribute('href') === com.href)!
    expect(l.tagName).toBe('A'); expect(l.getAttribute('href')).toBe(com.href)
    expect(l.textContent).toContain(com.nota)
    const off = within(m).getByText(sem.name).closest('[role="menuitem"]')!
    expect(off.textContent).toContain('ainda sem página')
    expect(off.tagName).not.toBe('A')
    const ver = within(m).getByRole('menuitem', { name: 'Ver meus canais na lista de Canais' })
    expect(ver.getAttribute('href')).toBe(link.canais())
  })
  it('o primeiro item recebe o foco; setas, Home e End andam pelos itens; Esc fecha e devolve o foco ao botão', async () => {
    const user = userEvent.setup()
    render(<MeuCanal owns={doisComVideos} />)
    const b = screen.getByRole('button', { name: /^Meu canal:/ })
    await user.click(b)
    const itens = within(menu()).getAllByRole('menuitem')
    expect(itens).toHaveLength(3) // dois canais e "Ver meus canais"
    expect(document.activeElement).toBe(itens[0])
    await user.keyboard('{ArrowDown}'); expect(document.activeElement).toBe(itens[1])
    await user.keyboard('{End}'); expect(document.activeElement).toBe(itens[2])
    await user.keyboard('{ArrowDown}'); expect(document.activeElement).toBe(itens[0]) // volta ao começo
    await user.keyboard('{ArrowUp}'); expect(document.activeElement).toBe(itens[2])
    await user.keyboard('{Home}'); expect(document.activeElement).toBe(itens[0])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(b)
  })
  it('seta para baixo no botão abre o menu no primeiro item; seta para cima, no último', async () => {
    const user = userEvent.setup()
    render(<MeuCanal owns={doisComVideos} />)
    const b = screen.getByRole('button', { name: /^Meu canal:/ })
    b.focus(); await user.keyboard('{ArrowUp}')
    const itens = within(menu()).getAllByRole('menuitem')
    expect(document.activeElement).toBe(itens[itens.length - 1])
  })
  it('clicar num item fecha o menu', async () => {
    const user = userEvent.setup()
    render(<MeuCanal owns={doisComVideos} />)
    await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
    await user.click(within(menu()).getByRole('menuitem', { name: 'Ver meus canais na lista de Canais' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('o canal apagado não é link, não entra nas setas e tem aria-disabled', async () => {
    const user = userEvent.setup()
    render(<MeuCanal owns={umSemVideos} />)
    await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
    const sem = umSemVideos.itens.find(i => !i.href)!
    const off = within(menu()).getByText(sem.name).closest('[role="menuitem"]') as HTMLElement
    expect(off.getAttribute('aria-disabled')).toBe('true')
    expect(off.closest('a')).toBeNull()
    expect(off.getAttribute('tabindex')).toBeNull()
    const focaveis = [...menu().querySelectorAll('a[role="menuitem"]')]
    expect(focaveis).toHaveLength(2)
    expect(focaveis).not.toContain(off)
    await user.keyboard('{ArrowDown}'); await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(focaveis[0]) // 2 itens focáveis: duas setas dão a volta
    await user.click(off) // clicar no apagado não faz nada
    expect(screen.getByRole('menu')).toBeTruthy()
  })
  it('na página do próprio canal o item tem aria-current="page"', async () => {
    const user = userEvent.setup()
    const principal = doisComVideos.principal!
    render(<MeuCanal owns={doisComVideos} atual={principal.id} />)
    await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
    const atuais = within(menu()).getAllByRole('menuitem').filter(i => i.getAttribute('aria-current') === 'page')
    expect(atuais).toHaveLength(1)
    expect(atuais[0]!.getAttribute('href')).toBe(principal.href)
  })
  it('sem `atual` nenhum item é a página atual', async () => {
    const user = userEvent.setup()
    render(<MeuCanal owns={doisComVideos} />)
    await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
    expect(menu().querySelector('[aria-current]')).toBeNull()
  })
  it('invariante: todo item com href leva a um destino montado por ownChannelHref ou por link.canais', async () => {
    const user = userEvent.setup()
    for (const owns of [doisComVideos, umSemVideos, ownMenuOf(a3World(undefined, 'mix').obs)]) {
      cleanup(); document.getElementById('flut')?.remove()
      render(<MeuCanal owns={owns} />)
      await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
      const ok = new Set([...owns.itens.map(i => ownChannelHref(i.id)), link.canais()])
      const hrefs = [...menu().querySelectorAll('a[role="menuitem"]')].map(a => a.getAttribute('href')!)
      expect(hrefs.length).toBeGreaterThan(1)
      for (const h of hrefs) expect(ok.has(h), h).toBe(true)
      // e todo link do menu corresponde a um item com href; o item sem href nunca vira link
      expect(hrefs.length).toBe(owns.itens.filter(i => i.href).length + 1)
    }
  })
})

describe('TrailChrome com o atalho', () => {
  const crumbs = [{ text: 'Canais', href: link.canais() }, { text: 'Leo Khev' }]
  it('com owns desenha o atalho à direita da trilha (antes do aside e da nota de fuso); sem owns, ou vazio, a trilha fica como hoje', () => {
    const { container, rerender } = render(<TrailChrome crumbs={crumbs} owns={doisComVideos} aside={<span data-t="aside">pager</span>}><p>x</p></TrailChrome>)
    const linha = container.querySelector('.obs-tr-top')!
    const filhos = [...linha.children].map(e => e.matches('nav.crumbs') ? 'trilha' : e.matches('[data-meu-canal]') ? 'atalho' : e.matches('.obs-tr-aside') ? 'aside' : e.matches('.obs-tr-tz') ? 'tz' : '?')
    expect(filhos).toEqual(['trilha', 'atalho', 'aside', 'tz'])
    expect(screen.getByRole('button', { name: /^Meu canal:/ })).toBeTruthy()
    for (const owns of [undefined, null, vazio]) {
      rerender(<TrailChrome crumbs={crumbs} owns={owns}><p>x</p></TrailChrome>)
      expect(container.querySelector('[data-meu-canal]')).toBeNull()
      expect([...container.querySelector('.obs-tr-top')!.children].map(e => e.className)).toEqual(['crumbs', 'obs-tr-tz'])
    }
  })
  it('na página do próprio canal o atalho marca o item (atual repassado)', async () => {
    const user = userEvent.setup()
    render(<TrailChrome crumbs={crumbs} owns={doisComVideos} atual={doisComVideos.principal!.id}><p>x</p></TrailChrome>)
    await user.click(screen.getByRole('button', { name: /^Meu canal:/ }))
    expect(menu().querySelector('[aria-current="page"]')).not.toBeNull()
  })
})

describe('ObservatoryChrome com o atalho', () => {
  it('a moldura do Observatório desenha o atalho no grupo de ações, ao lado de "Adicionar canal", nas quatro abas', () => {
    const tabs: ChromeTab[] = ['canais', 'mudancas', 'outliers', 'insights']
    for (const tab of tabs) {
      cleanup()
      const { container } = render(<ObservatoryChrome view={buildChromeView(mundo.obs, { tab, niche: 'todos' })}><div /></ObservatoryChrome>)
      const acoes = container.querySelector('.obs-ch-actions')!
      const filhos = [...acoes.children]
      const iAdd = filhos.findIndex(e => e.matches('a[title="Adicionar canal"]')), iMc = filhos.findIndex(e => e.matches('[data-meu-canal]'))
      expect(iMc, tab).toBeGreaterThan(-1)
      expect(iMc, `${tab}: ao lado de Adicionar canal`).toBe(iAdd + 1)
      expect(acoes.querySelector('[data-meu-canal] button')!.textContent).toContain(`Meu canal: ${mundo.obs.ownChannels()[0]!.name}`)
    }
  })
  it('site sem canal próprio: nenhum atalho na moldura', () => {
    const w = a3World(ds => {
      const own = new Set(ds.channels.filter(c => c.own).map(c => c.id))
      ds.channels = ds.channels.filter(c => !own.has(c.id)); ds.videos = ds.videos.filter(v => !own.has(v.ch))
    })
    const { container } = render(<ObservatoryChrome view={buildChromeView(w.obs, { tab: 'canais', niche: 'todos' })}><div /></ObservatoryChrome>)
    expect(container.querySelector('[data-meu-canal]')).toBeNull()
    expect(buildChromeView(w.obs, { tab: 'canais', niche: 'todos' }).owns.itens).toEqual([])
  })
})
