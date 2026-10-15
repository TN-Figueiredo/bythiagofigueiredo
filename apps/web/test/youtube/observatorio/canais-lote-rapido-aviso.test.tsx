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

describe('lote rápido: aviso de canais fora da lista', () => {
  function mundoGrande() {
    const w = a3World(ds => {
      const modelo = ds.channels.find(c => !c.own)!
      for (let i = 0; i < 70; i++) ds.channels.push({ ...modelo, id: `sintetico-${i}`, name: `Canal sintético ${i}`, handle: `@sint${i}` })
    }, '1')
    return w.obs
  }
  it('canal descendo depois da 50ª linha: o aviso aparece, o atalho liga o filtro, e some com "Mostrar mais"', async () => {
    const user = userEvent.setup()
    const o = mundoGrande()
    const base = vw({ medidas: medidasDoMotor(o), limit: 120 }, o)
    const fora = [...base.list.ranked, ...base.list.unranked].filter(r => !r.own)[60]!
    const medidas = medidasDoMotor(o, { [fora.id]: { m3a: direcaoMedida(50, 100) } })
    const v = vw({ medidas, limit: 120 }, o)
    const idx = [...v.list.ranked, ...v.list.unranked].filter(r => !r.own).findIndex(r => r.id === fora.id)
    expect(idx).toBeGreaterThanOrEqual(50)
    const { container } = mount({ medidas, limit: 120 }, o)
    const aviso = [...container.querySelectorAll('[data-k="aviso-fora-da-lista"]')].find(x => x.textContent?.includes('descendo'))!
    expect(aviso.textContent).toContain('Mais 1 canal descendo ainda não aparece aqui.')
    await user.click(within(aviso as HTMLElement).getByRole('button', { name: 'Ver só descendo' }))
    expect(replace.mock.calls.at(-1)![0]).toContain('direcao=desce')
    await user.click(screen.getByRole('button', { name: /^Mostrar mais/ }))
    await user.click(screen.getByRole('button', { name: /^Mostrar mais/ }))
    expect(container.querySelectorAll('[data-k="aviso-fora-da-lista"]').length).toBe(0)
  })
  function comDescendoFora() {
    const o = mundoGrande()
    const base = vw({ medidas: medidasDoMotor(o), limit: 120 }, o)
    const fora = [...base.list.ranked, ...base.list.unranked].filter(r => !r.own)[60]!
    return { o, medidas: medidasDoMotor(o, { [fora.id]: { m3a: direcaoMedida(50, 100) } }) }
  }
  it('o atalho "Ver só descendo" acende o anel da casa no clique, antes do servidor responder', async () => {
    replace.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { o, medidas } = comDescendoFora()
    const { container } = mount({ medidas, limit: 120 }, o)
    expect(container.querySelector('.obs-cn-casa.desce')!.getAttribute('aria-pressed')).toBe('false')
    const aviso = [...container.querySelectorAll('[data-k="aviso-fora-da-lista"]')].find(x => x.textContent?.includes('descendo'))!
    await user.click(within(aviso as HTMLElement).getByRole('button', { name: 'Ver só descendo' }))
    expect(container.querySelector('.obs-cn-casa.desce')!.getAttribute('aria-pressed')).toBe('true')
  })
  it('mais de 50 canais filtrados: a linha de estado traz o total filtrado, não os 50 da página (mata n = permitidos.size)', () => {
    const o = mundoGrande()
    const base = vw({ medidas: medidasDoMotor(o), limit: 120 }, o)
    const todos = [...base.list.ranked, ...base.list.unranked].filter(r => !r.own)
    const medidas = medidasDoMotor(o, Object.fromEntries(todos.map(r => [r.id, { m3a: direcaoMedida(100, 100) }])))
    const { container } = mount({ medidas, limit: 120, direcao: 'estavel' }, o)
    const v = vw({ medidas, limit: 120, direcao: 'estavel' }, o)
    const total = [...v.list.ranked, ...v.list.unranked].filter(r => !r.own).length
    expect(total).toBeGreaterThan(50)
    expect(container.querySelector('[data-k="paginacao"]')!.textContent).toContain(`Mostrando 50 de ${total} canais.`)
    expect(container.querySelector('[data-k="estado-do-filtro"]')!.textContent).toBe(`Só sem mudança: ${total} de ${v.resumo.direcao.canais} canais · Limpar filtro`)
  })
  it('aviso de 3 canais usa o plural e o botão não muda', async () => {
    const o = mundoGrande()
    const base = vw({ medidas: medidasDoMotor(o), limit: 120 }, o)
    const linhas = [...base.list.ranked, ...base.list.unranked].filter(r => !r.own)
    const medidas = medidasDoMotor(o, Object.fromEntries([55, 56, 57].map(i => [linhas[i]!.id, { m3a: direcaoMedida(50, 100) }])))
    const { container } = mount({ medidas, limit: 120 }, o)
    const aviso = [...container.querySelectorAll('[data-k="aviso-fora-da-lista"]')].find(x => x.textContent?.includes('descendo'))!
    expect(aviso.textContent).toContain('Mais 3 canais descendo ainda não aparecem aqui.')
    expect(within(aviso as HTMLElement).getByRole('button', { name: 'Ver só descendo' })).toBeTruthy()
  })
  it('com direção ligada, não há aviso', () => {
    const { o, medidas } = comDescendoFora()
    const { container } = mount({ medidas, limit: 120, direcao: 'sobe' }, o)
    expect(container.querySelectorAll('[data-k="aviso-fora-da-lista"]').length).toBe(0)
  })
  it('com busca digitada, não há aviso', async () => {
    const user = userEvent.setup()
    const { o, medidas } = comDescendoFora()
    const { container } = mount({ medidas, limit: 120 }, o)
    expect(container.querySelectorAll('[data-k="aviso-fora-da-lista"]').length).toBeGreaterThan(0)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar canal' }), 'Canal sintético')
    expect(container.querySelectorAll('[data-k="aviso-fora-da-lista"]').length).toBe(0)
  })
  it('sem canal medido fora do corte, não há aviso', () => {
    const { container } = mount({ medidas: medidasDoMotor(obs) })
    expect(container.querySelector('[data-k="aviso-fora-da-lista"]')).toBeNull()
  })
})
