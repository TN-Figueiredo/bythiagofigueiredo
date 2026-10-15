// @vitest-environment jsdom
// Lote rápido da tela Canais (14/10): dicas nos cabeçalhos e no valor da Direção, casas com cara de botão, frase-resumo clicável
// e o aviso "Mais N canal(is) <direção> ainda não aparece(m) aqui". Textos da Hanna (.superpowers/sdd/a5/discussao-direcao/hanna.md). Só dado sintético.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { direcaoMedida, medidasDoMotor } from './canais-e5a-fixture'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { replace.mockReset() })

const obs = createObservatory(datasetFromOracle(loadOracle()))
const vw = (p: Partial<CanaisParams> = {}, o = obs) => buildCanaisView(o, { niche: 'todos', limit: 75, fmt: 'longos', ...p })
const ok = async () => ({ ok: true })
function mount(p: Partial<CanaisParams> = {}, o = obs, props: Partial<CanaisScreenProps> = {}) {
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={vw(p, o)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
/** Passa o mouse na dica e devolve o texto que ela abre. */
async function dica(tip: Element): Promise<string> {
  const user = userEvent.setup()
  await user.hover(tip)
  const ler = () => document.getElementById(tip.getAttribute('aria-describedby') ?? '')?.textContent ?? ''
  await waitFor(() => expect(ler()).not.toBe(''), { timeout: 4000 })
  return ler()
}
const th = (container: HTMLElement, k: string) => container.querySelector(`th[data-k="${k}"]`)!

describe('lote rápido: dicas nos cabeçalhos de medida', () => {
  const TEXTOS: Record<string, string> = {
    active: 'Vídeos publicados por semana, nas últimas 13 semanas.',
    vpd: 'Views por dia dos vídeos do canal, por mil inscritos. Compara canais de tamanhos diferentes.',
    outliers: 'Vídeos com 2× ou mais as views típicas do canal, nos últimos 90 dias.',
    swaps: 'Mudanças de título e de thumbnail nos últimos 30 dias, longos e Shorts.',
    growth: 'Inscritos que o canal ganhou (+) ou perdeu (−) em 30 dias. O YouTube arredonda os inscritos a 3 algarismos; é diferente da Direção, que mede views.Empate: se o ganho ou a perda é menor que 2 passos do arredondamento, a diferença pode ser só arredondamento. Esses canais mostram "sem variação" com o limite de cada canal (±N) e ficam todos na mesma posição, entre quem cresceu e quem perdeu.',
  }
  for (const [k, texto] of Object.entries(TEXTOS)) {
    it(`o cabeçalho ${k} abre a dica com o texto da Hanna`, async () => {
      const { container } = mount({ medidas: medidasDoMotor(obs) })
      const tip = th(container, k).querySelector('.tip')
      expect(tip).not.toBeNull()
      expect(await dica(tip!)).toBe(texto)
    })
  }
  it('a coluna de posição explica a posição em toda ordenação (A5 2ª leva)', async () => {
    const sem = mount({ medidas: medidasDoMotor(obs), sort: 'growth' })
    const tip = sem.container.querySelector('thead th.p .tip')
    expect(tip).not.toBeNull()
    expect(await dica(tip!)).toBe('Posição pelo valor da coluna ordenada. 1º é o maior. Canais empatados dividem a posição.')
    sem.unmount()
    const com = mount({ medidas: medidasDoMotor(obs), sort: 'subs' })
    expect(com.container.querySelector('thead th.p .tip')).not.toBeNull()
  })
  it('o valor da Direção tem a dica com os dois totais da própria linha', async () => {
    const { container } = mount({ medidas: medidasDoMotor(obs, {}) })
    const linha = container.querySelector('tbody tr.row:not(.you)')!
    const tip = linha.querySelector('td.dir .cdica')
    expect(tip).not.toBeNull()
    expect(await dica(tip!)).toBe('Últimos 28 dias: 120 views. 28 dias anteriores: 100. Subiu 20%.')
  })
  it('a Direção que caiu diz "Caiu" e a que ficou no meio diz "Variou"', async () => {
    const [a, b] = obs.channels.filter(c => !c.own)
    const { container } = mount({ medidas: medidasDoMotor(obs, { [a!.id]: { m3a: direcaoMedida(70, 100) }, [b!.id]: { m3a: direcaoMedida(103, 100) } }) })
    expect(await dica(container.querySelector(`tr[data-id="${a!.id}"] td.dir .cdica`)!)).toBe('Últimos 28 dias: 70 views. 28 dias anteriores: 100. Caiu 30%.')
    expect(await dica(container.querySelector(`tr[data-id="${b!.id}"] td.dir .cdica`)!)).toBe('Últimos 28 dias: 103 views. 28 dias anteriores: 100. Variou +3%. Até 10% para cima ou para baixo conta como sem mudança.')
  })
  it('o Crescimento não usa o title nativo e não tem setas: sinal + ou −; a dica por célula escreve o intervalo', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const celula = [...container.querySelectorAll('tbody td.grow')].find(td => td.querySelector('.gr-n'))
    expect(celula).toBeTruthy()
    expect(celula!.querySelector('[title]')).toBeNull()
    expect(celula!.querySelector('svg')).toBeNull()
    expect(celula!.querySelector('.gr-n')!.textContent).toMatch(/^[+−]\d/)
    expect(celula!.querySelector('.cdica')).not.toBeNull()
  })
})

