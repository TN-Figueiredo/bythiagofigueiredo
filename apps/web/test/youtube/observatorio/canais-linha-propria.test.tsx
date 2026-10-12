// @vitest-environment jsdom
// A4 Tarefa 9 (revisão da T8, I1): a LINHA do canal próprio na lista de Canais não passa mais pela gaveta (que agora só redireciona e deixava
// um clique morto). Com vídeos, o nome e o avatar são links para a página do canal (o mesmo `link.canal` de "Abrir meu canal"), sem o lampejo do
// esqueleto da gaveta. Sem vídeos (o segundo canal do dono em produção, 16.8), a linha não é clicável e diz por quê, sem armadilha de foco.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisRow, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { RowMenu } from '@/app/cms/(authed)/youtube/competitors/_canais/row-menu'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { link } from '@/lib/youtube/observatorio/links'
import type { Observatory } from '@/lib/youtube/observatorio'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn(), prefetch = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams('fmt=longos'),
}))
beforeEach(() => { replace.mockReset(); refresh.mockReset(); push.mockReset(); prefetch.mockReset() })
afterEach(() => { document.getElementById('flut')?.remove() })

const ok = async () => ({ ok: true })
// o preset 2 tem dois canais próprios; o segundo fica sem vídeo nenhum (o canal novo do dono)
const w = a3World(ds => {
  const second = ds.channels.filter(c => c.own).sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))[1]!
  ds.videos = ds.videos.filter(v => v.ch !== second.id)
  second.undated = []
})
const [ID_COM, ID_SEM] = (() => {
  const own = w.obs.ownChannels()
  const sem = own.find(c => !w.obs.videos.some(v => v.ch === c.id) && c.undated.length === 0)!
  return [own.find(c => c.id !== sem.id)!.id, sem.id] as const
})()
const viewDe = (obs: Observatory = w.obs): CanaisView => buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos' })
const linhas = (v: CanaisView) => [...v.list.ranked, ...v.list.unranked]
const montar = () => render(
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
    <CanaisScreen view={viewDe()} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>,
)
const tr = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`tbody tr.row[data-id="${id}"]`)!

describe('I1 · o modelo da linha', () => {
  it('canal próprio com vídeos: href = a página do canal (a mesma de "Abrir meu canal"); sem vídeos: href null e o motivo em semPagina', () => {
    const v = viewDe()
    const com = linhas(v).find(r => r.id === ID_COM)!, sem = linhas(v).find(r => r.id === ID_SEM)!
    expect(com.href).toBe(link.canal(ID_COM))
    const cheia = v.own.block!.linhas.find(l => l.id === ID_COM)!
    expect(cheia.tipo === 'cheia' ? cheia.abrirHref : null).toBe(com.href)
    expect(com.semPagina).toBeNull()
    expect(sem.href).toBeNull()
    expect(sem.semPagina).toBe('sem vídeos: ainda sem página')
  })
  it('concorrente: continua com a página e sem motivo', () => {
    const c = linhas(viewDe()).find(r => !r.own)!
    expect(c.href).toBe(link.canal(c.id))
    expect(c.semPagina).toBeNull()
  })
})

describe('I1 · a linha do canal próprio COM vídeos', () => {
  it('o nome e o avatar são links para a página; não há botão que abre a gaveta', () => {
    const { container } = montar()
    const linha = tr(container, ID_COM)
    const nome = within(linha).getByRole('link', { name: /^Abrir a página de / })
    expect(nome.getAttribute('href')).toBe(link.canal(ID_COM))
    expect(linha.querySelector('a[data-avatar-link]')!.getAttribute('href')).toBe(link.canal(ID_COM))
    expect(within(linha).queryByRole('button', { name: /^Abrir detalhes de / })).toBeNull()
  })
  it('clicar no nome não pede a gaveta: nenhum ?channel=, nenhum esqueleto de gaveta, nenhum foco no "Fechar"', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    await user.click(within(tr(container, ID_COM)).getByRole('link', { name: /^Abrir a página de / }))
    for (const m of [replace, push]) for (const c of m.mock.calls) expect(String(c[0])).not.toContain('channel=')
    expect(container.querySelector('.cn-drawer, [data-drawer]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('I1 · a linha do canal próprio SEM vídeos', () => {
  it('não é clicável como linha: nenhum botão nem link no nome nem no avatar, e a linha diz por quê', () => {
    const { container } = montar()
    const linha = tr(container, ID_SEM)
    expect(linha.querySelector('button.nmbtn, a.nmbtn, a[data-avatar-link]')).toBeNull()
    const nome = linha.querySelector<HTMLElement>('.nmrow .nmbtn, .nmrow .nmtxt')!
    expect(nome.textContent).toBe(w.obs.channel(ID_SEM)!.name)
    expect(nome.getAttribute('tabindex')).toBeNull()
    expect(nome.getAttribute('role')).toBeNull()
    expect(within(linha).getByText('sem vídeos: ainda sem página')).toBeTruthy()
    // a frase é a descrição do nome (leitor de tela)
    const nota = within(linha).getByText('sem vídeos: ainda sem página')
    expect(nome.getAttribute('aria-describedby')).toBe(nota.id)
    expect(nota.id).not.toBe('')
  })
  it('clicar no nome não abre gaveta, não muda a URL e não deixa elemento focado morto', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    await user.click(tr(container, ID_SEM).querySelector<HTMLElement>('.nmrow .nmtxt')!)
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(container.querySelector('.cn-drawer, [data-drawer]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('.cn-drawer-close, [aria-label="Fechar detalhes do canal"]')).toBeNull()
  })
  it('o teclado não para em nada morto da linha: nenhum elemento focável é o nome', async () => {
    const user = userEvent.setup()
    const { container } = montar()
    const linha = tr(container, ID_SEM)
    const focaveis = [...linha.querySelectorAll<HTMLElement>('a[href], button, select, input, [tabindex]:not([tabindex="-1"])')]
    for (const f of focaveis) expect(f.closest('.nmrow')).toBeNull()
    await user.tab()
    expect(document.activeElement?.closest('tr.row[data-id="' + ID_SEM + '"] .nmrow')).toBeNull()
  })
  it('o bloco "Seus canais" tem a linha fina deste canal, só com "Ir até a linha" (sem "Abrir meu canal")', () => {
    const { container } = montar()
    const li = [...container.querySelectorAll('[data-own-block] li.fina')]
    expect(li).toHaveLength(1)
    expect(within(li[0] as HTMLElement).getAllByRole('button').map(b => b.textContent)).toEqual(['Ir até a linha'])
  })
})

describe('T10 (I1 da revisão da T9) · o menu ⋯ e o canal próprio', () => {
  const menu = () => screen.queryByRole('menu', { name: 'Ações do canal' })

  it('a linha e o cartão do canal próprio (com e sem vídeos) NÃO têm ⋯: o item "Abrir detalhes" morto não é alcançável pela lista', () => {
    const { container } = montar()
    for (const id of [ID_COM, ID_SEM]) {
      expect(container.querySelector(`[data-menu="${id}"]`)).toBeNull()
      expect(within(tr(container, id)).queryByRole('button', { name: /^Mais ações/ })).toBeNull()
    }
    // o concorrente continua com o ⋯ (a guarda não esconde o menu de todo mundo)
    const c = linhas(viewDe()).find(r => !r.own)!
    expect(container.querySelector(`tbody tr.row[data-id="${c.id}"] [data-menu="${c.id}"]`)).not.toBeNull()
  })

  const menuDe = (row: CanaisRow, onOpen = vi.fn()) => {
    render(<div data-obs-screen="canais"><button data-menu={row.id} type="button">⋯</button>
      <RowMenu row={row} onClose={vi.fn()} onOpen={onOpen} onSync={vi.fn()} onYoutube={vi.fn()} onCopy={vi.fn()} onRemove={vi.fn()} /></div>)
    return onOpen
  }

  it('RowMenu de uma linha sem página (defesa): "Abrir detalhes" fica desabilitado e diz por quê; clicar não faz nada; o foco nunca para no item morto', async () => {
    const user = userEvent.setup()
    const sem = linhas(viewDe()).find(r => r.id === ID_SEM)!
    const onOpen = menuDe(sem)
    const item = screen.getByRole('menuitem', { name: 'Abrir detalhes' }) as HTMLButtonElement
    expect(item.disabled).toBe(true)
    expect(item.getAttribute('title')).toBe('sem vídeos: ainda sem página')
    await user.click(item)
    expect(onOpen).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(item)
    expect(menu()!.contains(document.activeElement)).toBe(true)
  })

  it('RowMenu de uma linha com página: "Abrir detalhes" continua habilitado, sem title, e chama onOpen', async () => {
    const user = userEvent.setup()
    const c = linhas(viewDe()).find(r => !r.own)!
    const onOpen = menuDe(c)
    const item = screen.getByRole('menuitem', { name: 'Abrir detalhes' }) as HTMLButtonElement
    expect(item.disabled).toBe(false)
    expect(item.getAttribute('title')).toBeNull()
    await user.click(item)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
