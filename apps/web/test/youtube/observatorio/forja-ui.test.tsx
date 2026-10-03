// @vitest-environment jsdom
/**
 * Task 35 — the forja in the chrome (header button, status, heartbeat, drawer) and in Histórico (blockedBy).
 * The status click NEVER creates a request; the drawer is the only way to ask, and it sends what the engine planned.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Dataset } from '@/lib/youtube/observatorio'
import type { ForjaRequest, Niche } from '@/lib/youtube/observatorio/types'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { buildForjaView, buildForjaDrawerView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { ForjaHeaderButtons } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-status'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { oneFilledButton } from './audits'

const refresh = vi.fn(), push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh, push, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/outliers',
  useSearchParams: () => new URLSearchParams(''),
}))

const oracle = loadOracle()
const fresh = (): Dataset => datasetFromOracle(oracle)
function dbReq(ds: Dataset, niche: Niche, o: { type?: string; video?: string } = {}): ForjaRequest {
  const type = o.type ?? 'padroes-titulo'
  return {
    id: 'db-' + type + '-' + niche, type, niche, status: 'pending', video: o.video ?? null,
    target: o.video ? { kind: 'video', niche, video: o.video } : { kind: 'niche', niche, fmt: 'long' },
    state: 'na fila', createdAt: ds.now - 4 * 6e4, claimedAt: null, startedAt: null, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
  }
}
function wide(isWide: boolean) {
  window.matchMedia = ((q: string) => ({ matches: q.includes('max-width: 1279px') ? !isWide : false, media: q, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
}
function mountChrome(ds: Dataset, niche: 'todos' | 'viagem' | 'ia', onAsk = vi.fn(async () => ({ ok: true, reason: null, results: [{ niche: 'viagem' as Niche, ok: true, reason: null }] }))) {
  const obs = createObservatory(ds)
  const forja = buildForjaView(obs, { screen: 'outliers', niche })
  const view = buildChromeView(obs, { tab: 'outliers', niche, forja })
  const drawer = buildForjaDrawerView(obs, { niche, type: forja.type })
  const r = render(
    <ObservatoryChrome view={view} forjaDrawer={drawer} onAskForja={onAsk} onCancelForja={vi.fn(async () => ({ ok: true }))}>
      <div data-obs-screen="x"><section data-forja-anchor="" id="anchor">andamento</section></div>
    </ObservatoryChrome>,
  )
  return { ...r, onAsk, obs }
}

beforeEach(() => { refresh.mockReset(); push.mockReset(); wide(true) })

describe('header status', () => {
  it('clicking the status NEVER creates a request: no action prop is called; it goes to [data-forja-anchor]', async () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia'))
    const obs = createObservatory(ds)
    const forja = buildForjaView(obs, { screen: 'outliers', niche: 'ia' })
    const onOpen = vi.fn(), onStatus = vi.fn()
    render(<ForjaHeaderButtons forja={forja} drawerOpen={false} modal={false} onOpen={onOpen} onStatus={onStatus} />)
    fireEvent.click(screen.getByRole('button', { name: 'na fila · pedido 14:58' }))
    expect(onStatus).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pedido em andamento' })).toBeDisabled()
  })
  it('in the chrome: the status scrolls/focuses the anchor and no ask happens', async () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia'))
    const { onAsk } = mountChrome(ds, 'ia')
    Element.prototype.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: 'na fila · pedido 14:58' }))
    expect(document.activeElement).toBe(document.getElementById('anchor'))
    expect(onAsk).not.toHaveBeenCalled()
    expect(document.getElementById('obs-forja-drawer')).toBeNull()
  })
  it('the heartbeat segment: "forja consultou às 14:55"; no heartbeat → "sem máquina · nenhuma consulta registrada"', () => {
    mountChrome(fresh(), 'ia')
    expect(document.querySelector('[data-forja-machine]')!.textContent).toBe('forja consultou às14:55')
    const ds = fresh(); ds.queue.lastPollAt = null
    const { container } = mountChrome(ds, 'viagem')
    expect(container.querySelector('[data-forja-machine]')!.textContent).toBe('forja sem máquina · nenhuma consulta registrada')
  })
  it('capabilities [] → the button is disabled and says why', () => {
    const ds = fresh(); ds.queue.capabilities = []
    mountChrome(ds, 'ia')
    const b = screen.getByRole('button', { name: 'Pedir nova leitura à forja' })
    expect(b).toBeDisabled()
    expect(b).toHaveAccessibleDescription('A forja ainda não lê pedidos do observatório.')
  })
})

describe('drawer', () => {
  it('Todos + IA busy: the header keeps "Pedir leitura de Viagem à forja"; the drawer sends only Viagem', async () => {
    const user = userEvent.setup()
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia'))
    const { onAsk } = mountChrome(ds, 'todos')
    await user.click(screen.getByRole('button', { name: 'Pedir leitura de Viagem à forja' }))
    const d = document.getElementById('obs-forja-drawer')!
    expect(d).toHaveAttribute('role', 'complementary')   // ≥ 1280 px: a column, not a modal
    expect(within(d).getByRole('heading', { level: 3 })).toHaveTextContent('Pedir nova leitura à forja')
    await user.click(within(d).getByRole('button', { name: 'Continuar' }))
    expect(within(d).getByText(/Padrões de título dos outliers \(6 meses\) · Viagem/)).toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: 'Enviar pedido à forja' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('padroes-titulo', 'viagem', undefined, 'long'))
    expect(await screen.findByText('Pedido enviado à forja')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })
  it('below 1280 px the drawer is a modal: the content is inert; Esc closes and returns the focus to the opener', async () => {
    wide(false)
    const user = userEvent.setup()
    const { container } = mountChrome(fresh(), 'ia')
    const btn = screen.getByRole('button', { name: 'Pedir nova leitura à forja' })
    btn.focus()
    await user.click(btn)
    const d = document.getElementById('obs-forja-drawer')!
    expect(d).toHaveAttribute('role', 'dialog')
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(container.querySelector('.obs-ch-content')!.hasAttribute('inert')).toBe(true)
    fireEvent.keyDown(d, { key: 'Escape' })
    expect(document.getElementById('obs-forja-drawer')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pedir nova leitura à forja' })))
  })
  it('with the drawer open, the header button turns outlined (one filled button per view: the drawer\'s)', async () => {
    const user = userEvent.setup()
    const ds = fresh()
    const obs = createObservatory(ds)
    const forja = { ...buildForjaView(obs, { screen: 'insights', niche: 'ia' }) }
    const view = buildChromeView(obs, { tab: 'insights', niche: 'ia', forja })
    const { container } = render(<ObservatoryChrome view={view} forjaDrawer={buildForjaDrawerView(obs, { niche: 'ia' })}><div /></ObservatoryChrome>)
    expect(container.querySelector('[data-obs-chrome] .obs-ch-forja-solid')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Pedir nova leitura à forja' }))
    expect(container.querySelector('[data-obs-chrome] .obs-ch-forja-solid')).toBeNull()
    expect(oneFilledButton(container)).toEqual([])
  })
})

describe('Histórico blockedBy', () => {
  it('another video of the niche in the queue: the button is disabled with the reason and a link to that video', () => {
    const ds = fresh()
    const obs0 = createObservatory(ds)
    const other = obs0.videos.find(v => v.niche === 'ia' && v.id !== SHOWCASE && v.tracked && !obs0.channel(v.ch)!.own)!
    ds.requests.push(dbReq(ds, 'ia', { type: 'leitura-video', video: other.id }))
    const obs = createObservatory(ds)
    const view = buildHistoricoView(obs, SHOWCASE, { niche: 'ia' })
    render(<HistoricoScreen view={view} onAskForja={vi.fn()} />)
    const b = document.getElementById('askForja')!
    expect(b).toHaveAttribute('aria-disabled', 'true')
    const why = document.getElementById('askStatus')!
    // the engine's blockedBy.reason, without the "Nada enviado:" lead (historico-video.html bbMsg)
    expect(why.textContent).toMatch(/^Já há uma leitura de vídeo de IA na fila · pedido \d\d:\d\d, do vídeo “.+”\.$/)
    expect(within(why).getByRole('link', { name: other.title })).toHaveAttribute('href', obs.link.historico(other.id))
  })
})
