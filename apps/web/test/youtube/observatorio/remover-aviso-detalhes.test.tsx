// @vitest-environment jsdom
// F2 do Remover canal, T9: o aviso do canal agendado nos detalhes (gaveta e página do canal), sem botão, sem item de remover.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, within, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { mountCanal, canalActions } from './canal-mount'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { TXT } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'
import { lerRemovido } from '@/app/cms/(authed)/youtube/competitors/_canais/removido-flag'
import { link } from '@/lib/youtube/observatorio/links'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const DIA = 86_400_000
const IMPACTO = { ok: true as const, impact: { name: 'X', videos: 3, pinned: 0, versions: 3, dailyDays: 1, bookmarks: 0, readings: 0, watch: { readings: 0, thumbs: 0, alvos: 0 } }, semGuardar: { pode: true as const } }
beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); siteAdmin.value = true; sessionStorage.clear(); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

function gaveta(agendado: boolean) {
  let id = ''
  const w = a3World(ds => {
    const c = ds.channels.find(x => !x.own)!
    id = c.id
    if (agendado) c.removalRequestedAt = new Date(ds.now - 4 * DIA).toISOString()
  })
  const ok = async () => ({ ok: true })
  render(
    <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
      <h1>Canais</h1>
      <CanaisScreen view={buildCanaisView(w.obs, { niche: 'todos', limit: 75, fmt: 'longos', channel: id })} canUnlock={false} onAdd={ok} onPedir={ok as never} onApagar={ok as never} onDesfazer={ok as never} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} onRemovalImpact={vi.fn(async () => IMPACTO) as never} />
    </div></ChromeSyncContext.Provider></ToastProvider>,
  )
  return id
}

describe('detalhes · canal agendado', () => {
  it('AD9.1 a gaveta do agendado mostra o aviso, nenhum Desfazer e nenhum ícone de remover', () => {
    const id = gaveta(true)
    const d = document.querySelector<HTMLElement>(`[data-drawer="${id}"]`)!
    const aviso = d.querySelector('.agd-aviso')!
    expect(aviso.getAttribute('role')).toBe('status')
    expect(aviso.textContent).toContain(TXT.selo)
    expect(aviso.textContent).toContain(TXT.avisoDetalhes)
    expect(aviso.textContent).toContain('agendado há 4 dias')
    expect(aviso.querySelector('button')).toBeNull()
    expect(within(d).queryByRole('button', { name: /Desfazer/ })).toBeNull()
    expect(within(d).queryByRole('button', { name: 'Remover canal…' })).toBeNull()
  })

  it('AD9.1b a gaveta de um canal normal não muda: sem aviso e com o ícone de remover', () => {
    const id = gaveta(false)
    const d = document.querySelector<HTMLElement>(`[data-drawer="${id}"]`)!
    expect(d.querySelector('.agd-aviso')).toBeNull()
    expect(within(d).getByRole('button', { name: 'Remover canal…' })).toBeTruthy()
  })

  it('AD9.6 (U5) guardar pela gaveta: o foco volta ao título da gaveta', async () => {
    const user = userEvent.setup()
    const id = gaveta(false)
    const d = document.querySelector<HTMLElement>(`[data-drawer="${id}"]`)!
    await user.click(within(d).getByRole('button', { name: 'Remover canal…' }))
    await user.click(await screen.findByRole('button', { name: 'Parar coleta e agendar guarda no NAS' }))
    await act_()
    expect(document.activeElement?.id).toBe(`cn-d-${id}`)
  })

  it('AD9.2 o cabeçalho da página do canal agendado mostra o aviso e o menu não tem "Remover canal…"', async () => {
    const user = userEvent.setup()
    mountCanal({ mut: (ds, id) => { ds.channels.find(c => c.id === id)!.removalRequestedAt = new Date(ds.now - 2 * DIA).toISOString() } })
    const aviso = document.querySelector('header.chead .agd-aviso')!
    expect(aviso.textContent).toContain(TXT.avisoDetalhes)
    expect(aviso.textContent).toContain('agendado há 2 dias')
    expect(aviso.querySelector('button')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    const menu = document.querySelector('#flut [role="menu"]') as HTMLElement
    expect(within(menu).getByRole('menuitem', { name: 'Sincronizar só este canal' })).toBeTruthy()
    expect(within(menu).queryByRole('menuitem', { name: /Remover canal/ })).toBeNull()
  })

  it('AD9.3 canal sem pedido: sem aviso e com o item de remover', async () => {
    const user = userEvent.setup()
    mountCanal()
    expect(document.querySelector('.agd-aviso')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    expect(within(document.querySelector('#flut [role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Remover canal…' })).toBeTruthy()
  })

  async function abrirNaPagina(over: Parameters<typeof canalActions>[0] = {}) {
    const user = userEvent.setup()
    const act = canalActions({ onRemovalImpact: vi.fn(async () => IMPACTO) as never, ...over })
    const m = mountCanal({ act })
    await user.click(screen.getByRole('button', { name: 'Ações do canal' }))
    await user.click(within(document.querySelector('#flut [role="menu"]') as HTMLElement).getByRole('menuitem', { name: 'Remover canal…' }))
    return { user, act, m }
  }

  it('AD9.4 a janela da página do canal chama onPedir', async () => {
    const { user, act, m } = await abrirNaPagina()
    await user.click(await screen.findByRole('button', { name: 'Parar coleta e agendar guarda no NAS' }))
    expect(act.onPedir).toHaveBeenCalledWith(m.chId)
  })

  it('AD9.5 guardar: fica na página (toast com Desfazer + refresh, sem push), foco no título; o Desfazer do toast chama onDesfazer', async () => {
    const { user, act, m } = await abrirNaPagina()
    await user.click(await screen.findByRole('button', { name: 'Parar coleta e agendar guarda no NAS' }))
    await act_()
    expect(push).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByText(TXT.toastAgendadoTitulo)).toBeTruthy()
    expect(document.activeElement?.tagName).toBe('H1')
    await user.click([...document.querySelectorAll('.obs-ch-toast-acoes button')].find(b => b.textContent === 'Desfazer')!)
    expect(act.onDesfazer).toHaveBeenCalledWith(m.chId)
  })

  it('AD9.5b apagar: navega para a lista (sem ?removido= na URL) e deixa o aviso no estado do navegador, uma vez', async () => {
    const { user, act, m } = await abrirNaPagina({ onApagar: vi.fn(async () => ({ ok: true as const, videos: 3, leituras: 2, registrosDiarios: 9 })) as never })
    await user.click(screen.getByRole('radio', { name: /Entrou por engano/ }))
    await user.type(document.querySelector<HTMLInputElement>('.fld input')!, m.view.header.name)
    await user.click(screen.getByRole('button', { name: 'Apagar sem guardar' }))
    await act_()
    expect(act.onApagar).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(link.canais())
    expect(String(push.mock.calls[0]![0])).not.toContain('removido')
    expect(lerRemovido()).toEqual({ nome: m.view.header.name, videos: 3, leituras: 2 })
    expect(lerRemovido()).toBeNull()
  })
})
const act_ = () => act(async () => {})
