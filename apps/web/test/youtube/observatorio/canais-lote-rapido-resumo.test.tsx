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
let busca = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(busca),
}))
beforeEach(() => { replace.mockReset(); busca = '' })

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

describe('lote rápido: casas com cara de botão', () => {
  it('a legenda convida ao clique e, com a casa ligada, diz o que está filtrado', () => {
    const a = mount({ medidas: medidasDoMotor(obs) })
    expect(a.container.querySelector('[data-k="casas-legenda"]')!.textContent).toBe('Clique numa direção para ver só esses canais.')
    a.unmount()
    const b = mount({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    expect(b.container.querySelector('[data-k="casas-legenda"]')!.textContent).toBe('Mostrando só: subindo. Clique de novo para limpar.')
  })
})

describe('lote rápido: frase-resumo clicável e aviso de canais fora da lista', () => {
  it('"subindo" na frase é um botão que liga o mesmo filtro da casa', async () => {
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const frase = container.querySelector('[data-k="resumo-frase"]')!
    await user.click(within(frase as HTMLElement).getByRole('button', { name: 'Ver só os canais subindo' }))
    expect(replace.mock.calls.at(-1)![0]).toContain('direcao=sobe')
  })
  it('palavra com 0 canais não vira botão', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const frase = container.querySelector('[data-k="resumo-frase"]')!
    expect(within(frase as HTMLElement).queryByRole('button', { name: 'Ver só os canais descendo' })).toBeNull()
  })
})

describe('lote rápido: retorno imediato do clique na casa (Gio, 14/10)', () => {
  it('(a) o anel aparece no clique, antes de o servidor responder', async () => {
    replace.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const casa = container.querySelector<HTMLElement>('.obs-cn-casa.sobe')!
    expect(casa.getAttribute('aria-pressed')).toBe('false')
    await user.click(casa)
    expect(container.querySelector('.obs-cn-casa.sobe')!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-k="casas-legenda"]')!.textContent).toContain('Mostrando só: subindo')
  })
  it('(b) com filtro ligado, a linha "Só <filtro>: N de M canais · Limpar filtro" e o botão tira o filtro', async () => {
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    const linha = container.querySelector('[data-k="estado-do-filtro"]')!
    const v = vw({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    const n = [...v.list.ranked, ...v.list.unranked].filter(r => !r.own).length
    expect(n).toBeGreaterThan(0)
    expect(linha.textContent).toBe(`Só subindo: ${n} de ${v.resumo.direcao.canais} canais · Limpar filtro`)
    await user.click(within(linha as HTMLElement).getByRole('button', { name: 'Limpar filtro' }))
    expect(replace.mock.calls.at(-1)![0]).not.toContain('direcao=')
  })
  it('(b) a linha é anunciada ao leitor de tela (aria-live polite)', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    expect(container.querySelector('[data-k="estado-do-filtro"]')!.getAttribute('aria-live')).toBe('polite')
  })
  it('(b) dois filtros: "Só <direção> e também <estado>", estado em texto próprio (sem lower-case) e "Limpar filtros"', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs), direcao: 'sobe', filter: 'sairam' })
    const t = container.querySelector('[data-k="estado-do-filtro"]')!.textContent!
    expect(t).toMatch(/^Só subindo e também que saíram do YouTube: \d+ de \d+ canais · Limpar filtros$/)
    expect(t).not.toContain('youtube')
  })
  it('(b) só o filtro de estado: "Só parados: ..." e "Limpar filtro"; plural pelo total', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs), filter: 'parados' })
    const linha = container.querySelector('[data-k="estado-do-filtro"]')!
    expect(linha.textContent).toMatch(/^Só parados: \d+ de \d+ canais · Limpar filtro$/)
    expect(within(linha as HTMLElement).queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
  })
  it('(b) sem filtro, a linha não aparece', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    expect(container.querySelector('[data-k="estado-do-filtro"]')).toBeNull()
  })
  it('(d) a casa com 0 é um botão ativo, com a classe que ganha a borda', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    const zero = container.querySelector<HTMLButtonElement>('.obs-cn-casa.desce')!
    expect(zero.tagName).toBe('BUTTON')
    expect(zero.disabled).toBe(false)
    expect(zero.classList.contains('z')).toBe(true)
  })
})

describe('lote rápido: consertos da revisão do Yannis e do Gio (14/10)', () => {
  const spy = vi.fn()
  const reduzir = (sim: boolean) => { window.matchMedia = vi.fn((q: string) => ({ matches: sim && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia }
  beforeEach(() => { spy.mockReset(); Element.prototype.scrollIntoView = spy; reduzir(false) })
  const medidas = () => medidasDoMotor(obs)
  function ligando(reduz: boolean) {
    reduzir(reduz)
    const a = mount({ medidas: medidas() })
    expect(spy).not.toHaveBeenCalled()
    const v = vw({ medidas: medidas(), direcao: 'sobe' })
    a.rerender(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
    return a
  }
  it('ao ligar a direção, rola até o bloco do resumo (início), suave; com movimento reduzido, sem animação', () => {
    const a = ligando(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect((spy.mock.contexts[0] as HTMLElement).getAttribute('data-k')).toBe('resumo')
    a.unmount(); spy.mockReset()
    ligando(true)
    expect(spy).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
  })
  it('com a lista longe da casa (tela estreita), rola até a linha de estado, que fica logo acima da lista', () => {
    const real = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const k = this.getAttribute('data-k'), y = k === 'resumo' ? 0 : k === 'estado-do-filtro' ? 1300 : 0
      return { top: y, bottom: y + 20, left: 0, right: 390, width: 390, height: 20, x: 0, y, toJSON() {} } as DOMRect
    }
    try { ligando(false) } finally { Element.prototype.getBoundingClientRect = real }
    expect((spy.mock.contexts[0] as HTMLElement).getAttribute('data-k')).toBe('estado-do-filtro')
  })
  it('a linha de estado fica logo acima da barra de busca e da lista, não dentro do bloco das casas', () => {
    const { container } = mount({ medidas: medidas(), direcao: 'sobe' })
    const linha = container.querySelector('[data-k="estado-do-filtro"]')!
    expect(linha.closest('[data-k="resumo"]')).toBeNull()
    expect(linha.nextElementSibling?.className ?? '').toContain('toolbar')
  })
  it('abrir a página já com a direção ligada, e limpar o filtro, não rolam', () => {
    const a = mount({ medidas: medidas(), direcao: 'sobe' })
    expect(spy).not.toHaveBeenCalled()
    a.rerender(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={vw({ medidas: medidas() })} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
    expect(spy).not.toHaveBeenCalled()
  })
  it('"limpar" tira os dois filtros da URL', async () => {
    busca = 'filter=parados&direcao=sobe'
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidas(), direcao: 'sobe', filter: 'parados' })
    await user.click(within(container.querySelector('[data-k="estado-do-filtro"]') as HTMLElement).getByRole('button', { name: 'Limpar filtros' }))
    const url = replace.mock.calls.at(-1)![0] as string
    expect(url).not.toContain('filter=')
    expect(url).not.toContain('direcao=')
  })
  it('trocar de casa: a linha de estado some até o servidor responder (não mostra o número de um filtro com o nome de outro)', async () => {
    replace.mockReturnValue(new Promise(() => {}))
    busca = 'direcao=sobe'
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidas(), direcao: 'sobe' })
    expect(container.querySelector('[data-k="estado-do-filtro"]')).not.toBeNull()
    await user.click(container.querySelector('.obs-cn-casa.estavel')!)
    expect(container.querySelector('[data-k="estado-do-filtro"]')).toBeNull()
  })
})
