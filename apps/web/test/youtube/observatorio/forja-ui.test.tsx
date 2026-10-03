// @vitest-environment jsdom
/**
 * Task 35 — the forja in the chrome (header button, status, heartbeat) and in the screens (Mudanças, Histórico).
 * The status click NEVER creates a request: it scrolls to the screen's [data-forja-anchor] (CONVENCOES:215). The header
 * asks per each screen's mockup (R58): Insights/Canais/Outliers ask directly, Mudanças opens its inline confirm. The
 * moldura's selector drawer is not ported (R59).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { SHOWCASE } from './forja-scenarios'
import { createObservatory, type Dataset } from '@/lib/youtube/observatorio'
import type { ForjaRequest, Niche } from '@/lib/youtube/observatorio/types'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { buildForjaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { ForjaHeaderButtons } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-status'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { ReadingCard } from '@/app/cms/(authed)/youtube/competitors/_mudancas/reading-card'

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
function mountChrome(ds: Dataset, niche: 'todos' | 'viagem' | 'ia', onAsk = vi.fn(async () => ({ ok: true, reason: null, results: [{ niche: 'viagem' as Niche, ok: true, reason: null }] }))) {
  const obs = createObservatory(ds)
  const forja = buildForjaView(obs, { screen: 'outliers', niche })
  const view = buildChromeView(obs, { tab: 'outliers', niche, forja })
  const r = render(
    <ObservatoryChrome view={view} onAskForja={onAsk}>
      <div data-obs-screen="x"><section data-forja-anchor="" id="anchor">andamento</section></div>
    </ObservatoryChrome>,
  )
  return { ...r, onAsk, obs }
}

beforeEach(() => { refresh.mockReset(); push.mockReset() })

describe('header status', () => {
  it('clicking the status NEVER creates a request: no action prop is called; it goes to [data-forja-anchor]', async () => {
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia'))
    const obs = createObservatory(ds)
    const forja = buildForjaView(obs, { screen: 'outliers', niche: 'ia' })
    const onOpen = vi.fn(), onStatus = vi.fn()
    render(<ForjaHeaderButtons forja={forja} onOpen={onOpen} onStatus={onStatus} />)
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
  })
  it('the heartbeat segment: "forja consultou às 14:55"; no heartbeat → "sem máquina · nenhuma consulta registrada"', () => {
    mountChrome(fresh(), 'ia')
    expect(document.querySelector('[data-forja-machine]')!.textContent).toBe('forja consultou às 14:55')
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

describe('header flow per screen (R58)', () => {
  const ok = (n: Niche[]) => vi.fn(async () => ({ ok: true, reason: null, results: n.map(x => ({ niche: x, ok: true, reason: null })) }))
  const mount = (screenName: 'insights' | 'canais' | 'outliers' | 'mudancas', ds: Dataset, niche: 'todos' | 'viagem' | 'ia', onAsk: ReturnType<typeof ok>, child: React.ReactNode = <div />) => {
    const obs = createObservatory(ds)
    const forja = buildForjaView(obs, { screen: screenName, niche })
    const tab = screenName
    expect(forja.headerAction).toBe(screenName === 'mudancas' ? 'confirm' : 'ask')
    return render(<ObservatoryChrome view={buildChromeView(obs, { tab, niche, forja })} onAskForja={onAsk}>{child}</ObservatoryChrome>)
  }
  it('Insights asks DIRECTLY for the screen\'s type and niche (insights.html:819) and toasts', async () => {
    const user = userEvent.setup(), onAsk = ok(['ia'])
    mount('insights', fresh(), 'ia', onAsk)
    await user.click(screen.getByRole('button', { name: 'Pedir nova leitura à forja' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('padroes-titulo', 'ia', undefined, 'long'))
    expect(await screen.findByText('Leitura dos longos de IA.')).toBeInTheDocument()
  })
  it('Outliers with Todos + IA busy: one click asks only Viagem', async () => {
    const user = userEvent.setup(), onAsk = ok(['viagem'])
    const ds = fresh(); ds.requests.push(dbReq(ds, 'ia'))
    mount('outliers', ds, 'todos', onAsk)
    await user.click(screen.getByRole('button', { name: 'Pedir leitura de Viagem à forja' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('padroes-titulo', 'viagem', undefined, 'long'))
    expect(onAsk).toHaveBeenCalledTimes(1)
  })
  it('Canais with Todos asks one request per free niche, in click order (canais.html:874)', async () => {
    const user = userEvent.setup(), onAsk = ok(['ia'])
    mount('canais', fresh(), 'todos', onAsk)
    await user.click(screen.getByRole('button', { name: 'Pedir nova leitura à forja' }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(2))
    expect(onAsk.mock.calls.map(c => [c[0], c[1]])).toEqual([['resumo-trocas', 'ia'], ['resumo-trocas', 'viagem']])
    expect(await screen.findByText('Pedido enviado à forja: 2 pedidos, um por nicho (Viagem e IA)')).toBeInTheDocument()
  })
  it('Mudanças opens the inline preview; "Confirmar pedido" sends (mudancas.html:612)', async () => {
    const user = userEvent.setup(), onAsk = ok(['ia', 'viagem'])
    const ds = fresh(), obs = createObservatory(ds)
    const mv = buildMudancasView(obs, { niche: 'todos' }, new Set())
    mount('mudancas', ds, 'todos', onAsk, <details className="sumbox"><summary>x</summary><section className="forja"><ReadingCard view={mv} onAsk={onAsk} /></section></details>)
    await user.click(screen.getByRole('button', { name: 'Pedir nova leitura à forja' }))
    expect(onAsk).not.toHaveBeenCalled()
    const conf = await screen.findByRole('button', { name: 'Confirmar pedido' })
    expect(document.querySelector('.fj-confirm')!.textContent).toMatch(/Pedir nova leitura à forja \(um pedido por nicho\)/)
    await user.click(conf)
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('resumo-trocas', 'todos'))
    expect(await screen.findByText('Pedidos enviados à forja (um por nicho)')).toBeInTheDocument()
  })
  it('Mudanças "Cancelar" closes the preview without asking', async () => {
    const user = userEvent.setup(), onAsk = ok(['ia'])
    const ds = fresh(), obs = createObservatory(ds)
    const mv = buildMudancasView(obs, { niche: 'ia' }, new Set())
    mount('mudancas', ds, 'ia', onAsk, <details className="sumbox"><summary>x</summary><section className="forja"><ReadingCard view={mv} onAsk={onAsk} /></section></details>)
    await user.click(screen.getByRole('button', { name: 'Pedir nova leitura à forja' }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).toBeNull()
    expect(onAsk).not.toHaveBeenCalled()
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

describe('Mudanças reading card — evidence links never mis-paired', () => {
  const openIa = (ds: Dataset) => {
    const obs = createObservatory(ds)
    const view = buildMudancasView(obs, { niche: 'ia', reading: 'resumo-trocas-ia-20-10' }, new Set())
    return render(<ReadingCard view={view} />)
  }
  it('items = groups + reverts: each link sits inline after its literal item', () => {
    const { container } = openIa(fresh())
    const lis = [...container.querySelectorAll('[data-reading="resumo-trocas-ia-20-10"] .forja-voice li')]
    expect(lis.length).toBe(3)
    lis.forEach(li => expect(li.querySelector('a.lnk')).not.toBeNull())
    expect(container.querySelector('[data-evidence-site]')).toBeNull()
  })
  it('one extra item from the forja: no inline link; the group links go to "Do site", outside the seal, by verdict', () => {
    const ds = fresh()
    for (const r of ds.readings) if (r.id === 'resumo-trocas-ia-20-10') r.text = { ...r.text, items: [...r.text.items, 'Uma frase a mais da forja.'] }
    const { container } = openIa(ds)
    const voice = container.querySelector('[data-reading="resumo-trocas-ia-20-10"] .forja-voice')!
    expect(voice.querySelectorAll('a').length).toBe(0)
    const site = container.querySelector('[data-evidence-site]')!
    expect(voice.contains(site)).toBe(false)
    expect([...site.querySelectorAll('li')].map(li => li.textContent)).toEqual([
      'Tirou a 2ª notícia: caso isolado (n = 1) Ver a troca',
      'Reação no lugar do nome do produto: caso isolado (n = 1) Ver a troca',
      'Trocas que voltaram à versão anterior Ver a troca',
    ])
  })
})
