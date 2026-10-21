// @vitest-environment jsdom
// A5 2ª leva, T8: a dica por célula na tabela e nos cartões. Só dado sintético.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { medidasDoMotor } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { Observatory } from '@/lib/youtube/observatorio'

const replace = vi.fn(), push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

// Re-revisão C3: nenhum teste deste arquivo passa em verde sem afirmar.
beforeEach(() => { expect.hasAssertions(); replace.mockReset(); push.mockReset(); document.getElementById('flut')?.remove() })
// O jsdom do projeto não tem PointerEvent (Yannis I3).
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PE extends MouseEvent { pointerType: string; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerType = i.pointerType ?? 'mouse' } }
    Object.defineProperty(window, 'PointerEvent', { value: PE, configurable: true })
  }
})

const ok = async () => ({ ok: true })
function montar(p: Partial<CanaisParams> = {}, obs: Observatory = a3World().obs, onSyncOne: (id: string) => Promise<{ ok: boolean }> = ok) {
  const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', medidas: medidasDoMotor(obs), ...p })
  const r = render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={v} canUnlock={false} onAdd={ok} onPedir={ok} onApagar={ok} onDesfazer={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={onSyncOne} /></div></ChromeSyncContext.Provider></ToastProvider>)
  return { ...r, v }
}
const linhaDeConcorrente = (v: ReturnType<typeof montar>['v']) => {
  const r = [...v.list.ranked, ...v.list.unranked].find(x => !x.own)!
  return document.querySelector(`tbody tr[data-id="${r.id}"]`) as HTMLElement
}

describe('dicas por célula na tela', () => {
  it('nenhum title nativo nas células de VALOR da lista', () => {
    montar()
    expect(document.querySelectorAll('td[data-col]').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('td[data-col] [title]').length).toBe(0)
  })
  it('nenhum title nativo nas células de valor em "Todos" tampouco', () => {
    montar({ fmt: 'todos' })
    expect(document.querySelectorAll('td[data-col] [title]').length).toBe(0)
  })
  it('toda coluna de valor tem um gatilho de dica na linha de um CONCORRENTE', () => {
    const { v } = montar()
    expect(linhaDeConcorrente(v).querySelectorAll('.cdica').length).toBeGreaterThanOrEqual(8)
  })
  it('dica aberta: o gatilho aponta para a caixa (aria-describedby = id do tooltip) e anuncia aria-expanded', () => {
    montar()
    const g = document.querySelector('tbody tr td[data-col] .cdica') as HTMLElement
    fireEvent.focus(g)
    const caixa = screen.getByRole('tooltip')
    expect(g.getAttribute('aria-describedby')).toBe(caixa.id)
    expect(g.getAttribute('aria-expanded')).toBe('true')
  })
  it('tocar a dica não abre o painel do canal (a LINHA exclui .cdica)', () => {
    montar()
    const g = document.querySelector('tbody tr td[data-col] .cdica') as HTMLElement
    fireEvent.pointerDown(g, { pointerType: 'touch' }); fireEvent.click(g)
    expect(replace.mock.calls.some(c => String(c[0]).includes('channel='))).toBe(false)
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
  it('"Tentar de novo" fica fora do gatilho e chama o onSyncOne', async () => {
    const onSyncOne = vi.fn(ok)
    const w = a3World(ds => { const c = ds.channels.find(x => !x.own)!; c.sync.state = 'atrasado'; c.sync.msg = 'atrasou' })
    montar({}, w.obs, onSyncOne)
    const tentar = within(document.querySelector('table')!).getAllByRole('button', { name: 'Tentar de novo' })[0]!
    expect(tentar.closest('.cdica')).toBeNull()
    fireEvent.click(tentar)
    await waitFor(() => expect(onSyncOne).toHaveBeenCalledTimes(1))
  })
  it('"Todos": uma dica por linha de formato na coluna Views/dia', () => {
    const { v } = montar({ fmt: 'todos' })
    const td = linhaDeConcorrente(v).querySelector('td[data-col="vpd"]')!
    expect(td.querySelectorAll('.cdica').length).toBe(2)
  })
  it('o texto da dica de Inscritos vem à letra do modelo', () => {
    const { v } = montar()
    const r = [...v.list.ranked].find(x => !x.own && !x.subsOculto)!
    expect(r.dicas.subs).toMatch(/inscritos\./)
    expect(document.querySelector('.tip[aria-label="Sobre o número de inscritos"]')).toBeNull()
  })
  it('cartões: as mesmas dicas, sem title nativo nos valores', () => {
    montar({ layout: 'cards' })
    expect(document.querySelectorAll('.card .cdica').length).toBeGreaterThan(8)
    expect(document.querySelectorAll('.card .kv [title], .card .out [title]').length).toBe(0)
  })
})
