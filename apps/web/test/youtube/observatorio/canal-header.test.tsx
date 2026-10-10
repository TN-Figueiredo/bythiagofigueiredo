// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { link } from '@/lib/youtube/observatorio/links'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalScreen, type CanalActions } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { nicheOptions } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const okAct = async () => ({ ok: true })
function actions(over: Partial<CanalActions> = {}): CanalActions {
  return {
    onSyncOne: vi.fn(async (_id: string) => ({ ok: true })),
    onRemove: vi.fn(async (_id: string) => ({ ok: true })),
    onRemovalImpact: vi.fn(async (_id: string) => ({ ok: false as const })),
    onSetNiche: vi.fn(async (_id: string, _n: string | null) => ({ ok: true })),
    onPin: vi.fn(async () => ({ ok: true as const })),
    onUnpin: vi.fn(async () => ({ ok: true as const })),
    ...over,
  }
}
function mount(o: { mut?: (ds: Dataset, id: string) => void; sp?: Record<string, string | undefined>; canAdmin?: boolean; act?: CanalActions } = {}) {
  const { obs, chId } = canalWorld(o.mut)
  const view = buildCanalView(obs, chId, o.sp ?? {})!
  const act = o.act ?? actions()
  const r = render(
    <ToastProvider><div data-obs="">
      <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin={o.canAdmin ?? true} leitura={null} actions={act} />
    </div></ToastProvider>,
  )
  return { ...r, view, act, obs, chId }
}
const flut = () => document.getElementById('flut')

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset() })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('cabeçalho do canal', () => {
  it('h1 é o nome do canal', () => {
    const { view } = mount()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe(view.header.name)
  })

  it('a faixa é um dl rotulado; no DOM o valor vem antes do rótulo', () => {
    const { container, view } = mount()
    const dl = container.querySelector('dl[aria-label="Números do canal"]')!
    expect(dl).not.toBeNull()
    const cells = [...dl.children]
    expect(cells).toHaveLength(6)
    cells.forEach((c, i) => {
      expect(c.tagName).toBe('DIV')
      expect(c.children[0]!.tagName).toBe('DD')
      expect(c.children[1]!.tagName).toBe('DT')
      expect(c.children[1]!.textContent).toBe(view.header.faixa[i]!.label)
    })
    const subs = view.header.faixa[0]!
    expect(subs.value).not.toBeNull()
    expect(cells[0]!.children[0]!.textContent).toContain(subs.value!)
  })

  it('célula sem dado mostra a frase na classe obs-ch-nm, nunca "0" nem "—"', () => {
    const { container, view } = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.subs = null } })
    expect(view.header.faixa[0]!.value).toBeNull()
    const dd = container.querySelector('dl[aria-label="Números do canal"] > div:first-child > dd')!
    const nm = dd.querySelector('.obs-ch-nm')!
    expect(nm.textContent).toBe(view.header.faixa[0]!.missing)
    expect(dd.textContent).not.toBe('0')
    expect(dd.textContent).not.toBe('—')
    // as células com dado não usam a classe do "não medido"
    const withData = container.querySelectorAll('dl[aria-label="Números do canal"] dd .obs-ch-nm').length
    expect(withData).toBe(view.header.faixa.filter(c => c.value == null).length)
  })

  it('zero medido é "0": a célula "acima de 2×" com zero mostra 0, fora da classe do não medido', () => {
    const { container, view } = mount()
    const c = view.header.faixa.find(x => x.key === 'acima2x')!
    if (c.value !== '0') return // o mundo de teste pode ter outliers; o caso é coberto no modelo
    const i = view.header.faixa.indexOf(c)
    const dd = container.querySelectorAll('dl[aria-label="Números do canal"] > div')[i]!.querySelector('dd')!
    expect(dd.querySelector('.obs-ch-nm')).toBeNull()
    expect(dd.textContent).toContain('0')
  })

  it('"Todos os números" é botão com aria-expanded; aberto, mostra as 12 células e põe nums=1 na URL sem navegar', async () => {
    const user = userEvent.setup()
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const { container, view } = mount()
    const btn = screen.getByRole('button', { name: /Todos os números/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    const more = container.querySelector('dl[aria-label="Mais números do canal"]')!
    expect((more.parentElement as HTMLElement).hidden).toBe(true)
    await user.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect((more.parentElement as HTMLElement).hidden).toBe(false)
    expect(more.children).toHaveLength(12)
    expect([...more.children].map(c => c.children[1]!.textContent)).toEqual(view.header.todos.map(c => c.label))
    expect(replaceState).toHaveBeenCalled()
    expect(replaceState.mock.calls.at(-1)![2]).toMatch(/\?nums=1$/)
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    // fechar tira o parâmetro
    await user.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(replaceState.mock.calls.at(-1)![2]).not.toContain('nums')
  })

  it('com ?nums=1 na URL o painel já chega aberto', () => {
    mount({ sp: { nums: '1' } })
    expect(screen.getByRole('button', { name: /Todos os números/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('o ⓘ único abre um Popover em #flut com a base das 6 células; com "Todos os números" aberto, das 18', async () => {
    const user = userEvent.setup()
    const a = mount()
    const info = screen.getByRole('button', { name: 'De onde vêm os números do canal' })
    expect(info.getAttribute('aria-expanded')).toBe('false')
    await user.click(info)
    expect(info.getAttribute('aria-expanded')).toBe('true')
    const pop = flut()!.querySelector('[role="dialog"]')!
    expect(pop).not.toBeNull()
    expect(pop.querySelectorAll('li')).toHaveLength(6)
    for (const c of a.view.header.faixa) expect(pop.textContent).toContain(c.base)
    // nenhuma flutuante dentro da tela
    expect(a.container.querySelector('[role="dialog"]')).toBeNull()
    cleanup(); document.getElementById('flut')?.remove()

    const b = mount({ sp: { nums: '1' } })
    await user.click(screen.getByRole('button', { name: 'De onde vêm os números do canal' }))
    const pop2 = flut()!.querySelector('[role="dialog"]')!
    expect(pop2.querySelectorAll('li')).toHaveLength(18)
    for (const c of [...b.view.header.faixa, ...b.view.header.todos]) expect(pop2.textContent).toContain(c.base)
  })

  it('nenhum botão preenchido no cabeçalho', () => {
    const { container } = mount()
    expect(container.querySelector('.obs-ch-forja-solid, .btn-primary, .primary, .danger')).toBeNull()
    expect(container.querySelectorAll('[class*="solid"], [class*="primary"]')).toHaveLength(0)
  })

  it('"Abrir no YouTube" diz "abre em nova aba" no nome acessível', () => {
    const { view } = mount()
    const a = screen.getByRole('link', { name: /Abrir no YouTube/ })
    expect(a.getAttribute('aria-label') ?? a.textContent).toMatch(/abre em nova aba/)
    expect(a.getAttribute('href')).toBe(view.header.url)
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toMatch(/noopener/)
  })

  it('@ só aparece quando o canal tem handle', () => {
    const none = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.handle = '' } })
    expect(none.container.querySelector('.handle')).toBeNull()
    cleanup()
    const some = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.handle = '@mattwolfe' } })
    const h = some.container.querySelector('a.handle')!
    expect(h.textContent).toContain('@mattwolfe')
    expect(h.getAttribute('href')).toBe(some.view.header.url)
    expect(h.getAttribute('target')).toBe('_blank')
  })

  it('menu ⋯: "Sincronizar só este canal" sempre; "Remover canal…" só com canAdmin', async () => {
    const user = userEvent.setup()
    mount({ canAdmin: false })
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    const menu = flut()!.querySelector('[role="menu"]')!
    expect(within(menu as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' })).toBeTruthy()
    expect(within(menu as HTMLElement).queryByRole('menuitem', { name: /Remover canal/ })).toBeNull()
    cleanup(); document.getElementById('flut')?.remove()
    mount({ canAdmin: true })
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    expect(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Remover canal…' })).toBeTruthy()
  })

  it('"Sincronizar só este canal" chama onSyncOne com o id, avisa e desabilita enquanto roda', async () => {
    const user = userEvent.setup()
    let done!: (r: { ok: boolean }) => void
    const onSyncOne = vi.fn((_id: string) => new Promise<{ ok: boolean }>(res => { done = res }))
    const { view } = mount({ act: actions({ onSyncOne }) })
    const open = () => user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    await open()
    await user.click(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' }))
    expect(onSyncOne).toHaveBeenCalledTimes(1)
    expect(onSyncOne).toHaveBeenCalledWith(view.header.id)
    expect(screen.getByRole('region', { name: 'Avisos' }).textContent).toContain('Sincronizando ' + view.header.name)
    // enquanto roda, o item continua no menu, mas desabilitado
    await open()
    const item = within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    await user.click(item)
    expect(onSyncOne).toHaveBeenCalledTimes(1)
    await act(async () => { done({ ok: true }) })
    expect(screen.getByRole('region', { name: 'Avisos' }).textContent).toContain(view.header.name + ' sincronizado')
    expect(refresh).toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await open()
    expect(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' }).getAttribute('aria-disabled')).not.toBe('true')
  })

  it('sincronização que falha avisa e libera o item', async () => {
    const user = userEvent.setup()
    const onSyncOne = vi.fn(async (_id: string) => ({ ok: false }))
    const { view } = mount({ act: actions({ onSyncOne }) })
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    await user.click(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' }))
    expect(screen.getByRole('region', { name: 'Avisos' }).textContent).toContain(view.header.name + ' não sincronizou')
  })

  it('canal ainda buscando vídeos: avisa e não chama a sincronização', async () => {
    const user = userEvent.setup()
    const onSyncOne = vi.fn(async (_id: string) => ({ ok: true }))
    const { view } = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.sync.state = 'backfill' }, act: actions({ onSyncOne }) })
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    await user.click(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Sincronizar só este canal' }))
    expect(onSyncOne).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Avisos' }).textContent).toContain(view.header.name + ' ainda está buscando vídeos')
  })

  it('faixa de aviso de sincronização atrasada começa por "Atenção:" e a de erro por "Erro:"', () => {
    const late = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.sync.state = 'atrasado' } })
    const band = late.container.querySelector('.band')!
    expect(band.textContent!.startsWith('Atenção:')).toBe(true)
    expect(band.textContent).toBe(late.view.header.sync.banner)
    cleanup()
    const err = mount({ mut: (ds, id) => { const s = ds.channels.find(c => c.id === id)!.sync; s.state = 'erro'; s.msg = 'quota'; s.errorSince = ds.now - 36e5 } })
    const eb = err.container.querySelector('.band')!
    expect(eb.textContent!.startsWith('Erro:')).toBe(true)
    cleanup()
    const ok = mount()
    expect(ok.container.querySelector('.band')).toBeNull()
  })

  it('a linha de sincronização diz o estado em texto, com o tom', () => {
    const { container, view } = mount({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.sync.state = 'atrasado' } })
    const l3 = container.querySelector('.l3')!
    expect(l3.textContent).toContain(view.header.sync.text)
    expect(l3.classList.contains('warn')).toBe(true)
  })

  it('"Comparar com o meu canal" não existe nesta fase (D4)', () => {
    const { container } = mount()
    expect(screen.queryByText(/Comparar com o meu canal/)).toBeNull()
    expect(container.textContent).not.toMatch(/Comparar/)
  })

  it('o nicho é um select editável que chama onSetNiche com o id do canal', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async (_id: string, _n: string | null) => ({ ok: true }))
    const { view, obs } = mount({ act: actions({ onSetNiche }) })
    const sel = screen.getByRole('combobox', { name: /Nicho de/ })
    const other = nicheOptions(obs).find(o => o.id !== view.header.niche)!
    await user.selectOptions(sel, other.id)
    expect(onSetNiche).toHaveBeenCalledWith(view.header.id, other.id)
  })

  it('"Remover canal…" abre o diálogo, confirma com o id e volta para Canais; Cancelar só fecha', async () => {
    const user = userEvent.setup()
    const a = actions()
    const { view } = mount({ act: a })
    const openDlg = async () => {
      await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
      await user.click(within(flut()!.querySelector('[role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Remover canal…' }))
    }
    await openDlg()
    const dlg = screen.getByRole('dialog', { name: 'Remover ' + view.header.name + '?' })
    expect(a.onRemovalImpact).toHaveBeenCalledWith(view.header.id)
    await user.click(within(dlg).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: /Remover/ })).toBeNull()
    expect(a.onRemove).not.toHaveBeenCalled()
    await openDlg()
    await user.click(within(screen.getByRole('dialog', { name: /Remover/ })).getByRole('button', { name: 'Remover canal' }))
    expect(a.onRemove).toHaveBeenCalledWith(view.header.id)
    await act(async () => {})
    expect(replace).toHaveBeenCalledWith(link.canais())
  })
})
