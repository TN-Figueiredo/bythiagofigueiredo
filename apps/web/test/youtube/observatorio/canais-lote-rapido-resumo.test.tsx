// @vitest-environment jsdom
// Lote rápido da tela Canais (14/10): dicas nos cabeçalhos e no valor da Direção, casas com cara de botão, frase-resumo clicável
// e o aviso "Ainda há N canal(is) <direção> fora desta lista". Textos da Hanna (.superpowers/sdd/a5/discussao-direcao/hanna.md). Só dado sintético.
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
  it('(b) com filtro ligado, a linha "Mostrando N de M · filtro · limpar" e o limpar tira o filtro', async () => {
    const user = userEvent.setup()
    const { container } = mount({ medidas: medidasDoMotor(obs), direcao: 'sobe' })
    const linha = container.querySelector('[data-k="estado-do-filtro"]')!
    expect(linha.textContent).toMatch(/^Mostrando \d+ de \d+ canais · subindo · limpar$/)
    await user.click(within(linha as HTMLElement).getByRole('button', { name: 'limpar' }))
    expect(replace.mock.calls.at(-1)![0]).not.toContain('direcao=')
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
