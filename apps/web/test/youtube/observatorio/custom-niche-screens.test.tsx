// @vitest-environment jsdom
// Telas do Observatório com nichos criados pelo dono (Jogos com um concorrente; Pessoal recém-criado, vazio).
// O oráculo é carregado UMA vez; os motores são montados uma vez por arquivo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { BUILTIN_NICHES, type NicheDef } from '@/lib/youtube/observatorio/niche'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildChromeView, coworkText } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'
import { buildForjaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { groupColor } from '@/app/cms/(authed)/youtube/competitors/_canais/channel-table'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'
import { InsightsScreen } from '@/app/cms/(authed)/youtube/competitors/_insights/insights-screen'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { noJunkText } from './audits'

const replace = vi.fn(), refresh = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const O = loadOracle()
const def = (id: string, label: string, dark: string, light: string, order: number): NicheDef => ({ id, label, color: { dark, light }, order, builtin: false })
const jogos = def('jogos', 'Jogos', '#D29AE8', '#7B2A91', 100), pessoal = def('pessoal', 'Pessoal', '#F293C2', '#A3216B', 110)
const culinaria = def('culinaria', 'Culinária', '#B9CB62', '#55650B', 120), financas = def('financas', 'Finanças', '#AAB4C0', '#4B5563', 130)
/** Jogos recebe um concorrente que era de IA; outro concorrente de IA fica sem nicho (para o grupo "Sem nicho" existir). */
function dataset(extra: NicheDef[]): { ds: Dataset; moved: string; none: string } {
  const ds = datasetFromOracle(O)
  const ias = ds.channels.filter(c => !c.own && c.niche === 'ia' && c.sync.state === 'ok')
  const moved = ias[0]!.id, none = ias[1]!.id
  const set = (id: string, n: string | null) => { ds.channels.find(c => c.id === id)!.niche = n; for (const v of ds.videos) if (v.ch === id) v.niche = n }
  set(moved, 'jogos'); set(none, null)
  return { ds: { ...ds, niches: [...BUILTIN_NICHES, ...extra] }, moved, none }
}
const D3 = dataset([jogos]), D4 = dataset([jogos, pessoal]), D6 = dataset([jogos, pessoal, culinaria, financas])
const obs2 = createObservatory(datasetFromOracle(O)), obs3 = createObservatory(D3.ds), obs4 = createObservatory(D4.ds), obs6 = createObservatory(D6.ds)
const MOVED = D3.moved
const junk = (root: Element) => (root.textContent ?? '').match(/undefined|NaN|\[object/g)

const canais = (o = obs3, p: Partial<CanaisParams> = {}) => buildCanaisView(o, { niche: 'todos', limit: 75, ...p })
const ok = async () => ({ ok: true })
function mountCanais(o = obs3, p: Partial<CanaisParams> = {}, props: Partial<CanaisScreenProps> = {}) {
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={canais(o, p)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
const mountChrome = (o = obs3, niche = 'todos', props: Partial<Parameters<typeof ObservatoryChrome>[0]> = {}) =>
  render(<ObservatoryChrome view={buildChromeView(o, { tab: 'canais', niche })} {...props}><div>tela</div></ObservatoryChrome>)

beforeEach(() => { replace.mockReset(); refresh.mockReset(); search = '' })

describe('barra de nicho', () => {
  it('três nichos: quatro botões na ordem Todos, Viagem, IA, Jogos, com a contagem de cada um', () => {
    const { container } = mountChrome()
    const btns = [...container.querySelectorAll<HTMLElement>('.obs-ch-seg-ctl [data-niche]')]
    expect(btns.map(b => b.dataset.niche)).toEqual(['todos', 'viagem', 'ia', 'jogos'])
    expect(btns.map(b => b.firstElementChild?.classList.contains('obs-ch-sw') ? b.childNodes[1]!.textContent : b.childNodes[0]!.textContent)).toEqual(['Todos', 'Viagem', 'IA', 'Jogos'])
    expect(within(btns[3]!).getByText('1', { selector: '.obs-ch-n' })).toBeTruthy()
    expect(junk(container)).toBeNull()
  })
  it('a cor do nicho criado vai nas mesmas variáveis CSS dos de fábrica', () => {
    const { container } = mountChrome()
    const sw = container.querySelector<HTMLElement>('[data-niche="jogos"] .obs-ch-sw')!
    expect(sw.style.getPropertyValue('--obs-sw-dark')).toBe('#D29AE8')
    expect(sw.style.getPropertyValue('--obs-sw-light')).toBe('#7B2A91')
  })
  it('só com os dois de fábrica a barra não ganha o modo de rolagem (o desenho de hoje não muda)', () => {
    const two = mountChrome(obs2)
    expect(two.container.querySelector('.obs-ch-nav')!.hasAttribute('data-niche-scroll')).toBe(false)
    two.unmount()
    const three = mountChrome(obs3)
    expect(three.container.querySelector('.obs-ch-nav')!.hasAttribute('data-niche-scroll')).toBe(true)
  })
  it('seis nichos: o nicho ativo é trazido para a vista dentro do trilho (a página não rola)', () => {
    const { container } = mountChrome(obs6, 'financas')
    const rail = container.querySelector<HTMLElement>('.obs-ch-seg-ctl')!
    expect([...rail.querySelectorAll<HTMLElement>('[data-niche]')].map(b => b.dataset.niche)).toEqual(['todos', 'viagem', 'ia', 'jogos', 'pessoal', 'culinaria', 'financas'])
    const cur = rail.querySelector<HTMLElement>('[aria-pressed="true"]')!
    expect(cur.dataset.niche).toBe('financas')
    // jsdom não mede; damos as medidas e disparamos o ajuste
    Object.defineProperty(rail, 'clientWidth', { configurable: true, value: 200 })
    Object.defineProperty(rail, 'scrollWidth', { configurable: true, value: 700 })
    rail.getBoundingClientRect = () => ({ left: 0, right: 200, top: 0, bottom: 32, width: 200, height: 32, x: 0, y: 0, toJSON: () => ({}) })
    cur.getBoundingClientRect = () => ({ left: 600, right: 700, top: 0, bottom: 32, width: 100, height: 32, x: 600, y: 0, toJSON: () => ({}) })
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(rail.scrollLeft).toBe(540)
    expect(rail.classList.contains('obs-ch-less')).toBe(true)
  })
  it('retorno imediato: o nicho clicado aparece pressionado ANTES de a action resolver; a action recebe o slug', async () => {
    const user = userEvent.setup()
    let done!: (v: { ok: boolean }) => void
    const onSetNiche = vi.fn(() => new Promise<{ ok: boolean }>(r => { done = r }))
    const { container } = mountChrome(obs3, 'todos', { onSetNiche })
    await user.click(container.querySelector<HTMLElement>('[data-niche="jogos"]')!)
    expect(onSetNiche).toHaveBeenCalledWith('jogos')
    expect(container.querySelector('[data-niche="jogos"]')!.getAttribute('aria-pressed')).toBe('true')
    expect(replace).not.toHaveBeenCalled()
    await act(async () => { done({ ok: true }) })
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?niche=jogos', { scroll: false })
  })
  it('"Copiar pedido para o Cowork" usa o rótulo do nicho', () => {
    expect(coworkText('canais', 'jogos', 'Jogos')).toContain('(nicho Jogos)')
    expect(buildChromeView(obs3, { tab: 'canais', niche: 'jogos' }).cowork).toContain('(nicho Jogos)')
    expect(buildChromeView(obs2, { tab: 'canais', niche: 'ia' }).cowork).toContain('(nicho IA)')
  })
})

describe('Canais', () => {
  it('Todos: um grupo por nicho que tem canal, na ordem das abas, e "Sem nicho" por último; nicho vazio não ganha grupo', () => {
    expect(canais(obs4).groups.map(g => [g.key, g.label])).toEqual([['viagem', 'Viagem'], ['ia', 'IA'], ['jogos', 'Jogos'], ['sem', 'Sem nicho']])
    const { container } = mountCanais(obs4)
    expect([...container.querySelectorAll('tr.group:not([data-own-group]) strong')].map(e => e.textContent)).toEqual(['Viagem', 'IA', 'Jogos', 'Sem nicho'])
    expect(junk(container)).toBeNull()
    expect(noJunkText(container)).toEqual([])
  })
  it('a cor do grupo: os de fábrica continuam em var(--travel) / var(--ai); o criado usa a cor do nicho por variável CSS', () => {
    expect(groupColor('viagem')).toBe('var(--travel)')
    expect(groupColor('ia')).toBe('var(--ai)')
    expect(groupColor('sem')).toBe('var(--muted)')
    expect(groupColor('jogos')).toBe('var(--obs-niche)')
    const { container } = mountCanais()
    const dot = [...container.querySelectorAll<HTMLElement>('tr.group .dot')].find(d => d.closest('tr')!.textContent!.includes('Jogos'))!
    expect(dot.style.getPropertyValue('--obs-sw-dark')).toBe('#D29AE8')
    expect(dot.style.getPropertyValue('--obs-sw-light')).toBe('#7B2A91')
  })
  it('o seletor de nicho da linha tem os nichos do site, na ordem das abas; o canal de Jogos mostra Jogos', () => {
    const { container } = mountCanais()
    const sel = container.querySelector<HTMLSelectElement>(`select[data-niche="${MOVED}"][data-ctx="row"]`)!
    expect([...sel.options].filter(o => !o.disabled).map(o => [o.value, o.textContent])).toEqual([['viagem', 'Viagem'], ['ia', 'IA'], ['jogos', 'Jogos']])
    expect(sel.value).toBe('jogos')
    expect(sel.classList.contains('custom')).toBe(true)
    expect(sel.style.getPropertyValue('--obs-sw-dark')).toBe('#D29AE8')
    // os de fábrica mantêm as classes de hoje e não levam variável
    const via = container.querySelector<HTMLSelectElement>('select.niche.viagem')!
    expect(via.style.getPropertyValue('--obs-sw-dark')).toBe('')
  })
  it('retorno imediato: trocar o nicho para Jogos mostra o valor ANTES de a action resolver, e volta se ela falhar', async () => {
    const user = userEvent.setup()
    let done!: (v: { ok: boolean }) => void
    const onSetNiche = vi.fn(() => new Promise<{ ok: boolean }>(r => { done = r }))
    const { container } = mountCanais(obs3, {}, { onSetNiche })
    const id = obs3.channels.find(c => !c.own && c.niche === 'viagem')!.id
    const sel = () => container.querySelector<HTMLSelectElement>(`select[data-niche="${id}"][data-ctx="row"]`)!
    await user.selectOptions(sel(), 'jogos')
    expect(onSetNiche).toHaveBeenCalledWith(id, 'jogos')
    expect(sel().value).toBe('jogos')
    expect(sel().getAttribute('aria-busy')).toBe('true')
    await act(async () => { done({ ok: false }) })
    await waitFor(() => expect(sel().value).toBe('viagem'))
    expect(screen.getByText('Não deu para mudar o nicho')).toBeTruthy()
  })
  it('o aviso da troca diz o rótulo do nicho criado', async () => {
    const user = userEvent.setup()
    const { container } = mountCanais()
    const id = obs3.channels.find(c => !c.own && c.niche === 'viagem')!
    await user.selectOptions(container.querySelector<HTMLSelectElement>(`select[data-niche="${id.id}"][data-ctx="row"]`)!, 'jogos')
    await waitFor(() => expect(screen.getByText(`Nicho de ${id.name} alterado para Jogos`)).toBeTruthy())
  })
  it('um valor fora da lista nunca chega à action', () => {
    const onSetNiche = vi.fn(ok)
    const { container } = mountCanais(obs3, {}, { onSetNiche })
    const sel = container.querySelector<HTMLSelectElement>(`select[data-niche="${MOVED}"][data-ctx="row"]`)!
    const o = document.createElement('option'); o.value = 'sumiu'; sel.appendChild(o)
    fireEvent.change(sel, { target: { value: 'sumiu' } })
    expect(onSetNiche).not.toHaveBeenCalled()
  })
  it('Adicionar canal: até 3 nichos, botões; a partir de 4, um seletor; o nicho da aba vem escolhido', () => {
    expect(canais(obs3).add.niches).toEqual([{ id: 'viagem', label: 'Viagem' }, { id: 'ia', label: 'IA' }, { id: 'jogos', label: 'Jogos' }])
    expect(canais(obs3).add.defaultNiche).toBe('viagem')
    expect(canais(obs3, { niche: 'jogos' }).add.defaultNiche).toBe('jogos')
    const three = mountCanais(obs3, { add: '1' })
    const seg = three.container.querySelector('[role="dialog"] .seg')!
    expect([...seg.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Viagem', 'IA', 'Jogos'])
    expect(three.container.querySelector('[role="dialog"] select[name="addNiche"]')).toBeNull()
    three.unmount()
    const four = mountCanais(obs4, { add: '1', niche: 'jogos' })
    const sel = four.container.querySelector<HTMLSelectElement>('[role="dialog"] select[name="addNiche"]')!
    expect([...sel.options].map(o => [o.value, o.textContent])).toEqual([['viagem', 'Viagem'], ['ia', 'IA'], ['jogos', 'Jogos'], ['pessoal', 'Pessoal']])
    expect(sel.value).toBe('jogos')
    expect(four.container.querySelector('[role="dialog"] .seg')).toBeNull()
  })
  it('Adicionar canal envia o slug do nicho criado e o aviso diz o rótulo', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => ({ ok: true, title: 'Canal Novo' }))
    mountCanais(obs3, { add: '1' }, { onAdd })
    const dlg = screen.getByRole('dialog', { name: 'Adicionar canal' })
    await user.type(within(dlg).getByPlaceholderText('@handle ou URL do canal'), '@CanalNovo')
    await user.click(within(dlg).getByRole('button', { name: 'Jogos' }))
    await user.click(within(dlg).getByRole('button', { name: 'Adicionar canal' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ channel: '@CanalNovo', niche: 'jogos', videoLimit: 50 }))
    await waitFor(() => expect(screen.getByText('Canal Novo entrou em Jogos; a busca dos vídeos começou.')).toBeTruthy())
  })
  it('nicho recém-criado, sem canal nenhum: a aba abre vazia com o texto de vazio de hoje e a forja desabilitada', () => {
    const v = canais(obs4, { niche: 'pessoal' })
    expect(v.groups).toEqual([])
    expect(v.nicheLabel).toBe('Pessoal')
    expect(v.emptyText).toMatch(/^Nenhum (canal|concorrente) em Pessoal\. /)
    expect(v.forja.button).toMatchObject({ mode: 'disabled', disabledText: 'Nenhum concorrente em Pessoal ainda' })
    expect(v.forja.ask).toBeNull()
    const { container } = mountCanais(obs4, { niche: 'pessoal' })
    expect(junk(container)).toBeNull()
  })
  it('o editor "Definir nicho dos canais" ordena pelos nichos do site (Jogos depois de IA, sem nicho por último)', () => {
    const order = canais(obs3).nicheRows.map(r => r.niche)
    const rank = (n: string | null) => (n == null ? 99 : ['viagem', 'ia', 'jogos'].indexOf(n))
    expect(order.map(rank)).toEqual([...order.map(rank)].sort((a, b) => a - b))
    expect(order).toContain('jogos')
    expect(order[order.length - 1]).toBeNull()
  })
  it('gaveta de um canal de Jogos: a caixa da forja fala de Jogos', () => {
    const f = canais(obs3, { channel: MOVED }).drawerForja!
    expect(f.niche).toBe('jogos')
    expect(f.head).toBe('Resumo das trocas de Jogos, o nicho inteiro, não só deste canal')
    expect(JSON.stringify(f)).not.toMatch(/undefined|NaN/)
  })
})

describe('forja (botão do cabeçalho)', () => {
  it('Todos: um bloco por nicho com concorrente, na ordem da forja (IA, Viagem, Jogos); Pessoal fica de fora', () => {
    const f = buildForjaView(obs4, { screen: 'canais', niche: 'todos' })
    expect(f.niches.map(b => [b.niche, b.label])).toEqual([['ia', 'IA'], ['viagem', 'Viagem'], ['jogos', 'Jogos']])
    expect(f.ask).toEqual({ scope: 'todos', niches: ['ia', 'viagem', 'jogos'] })
    expect(f.button.mode).toBe('free')
  })
  it('nicho com concorrente: botão livre e o pedido vai para o slug', () => {
    const f = buildForjaView(obs3, { screen: 'insights', niche: 'jogos' })
    expect(f.button.mode).toBe('free')
    expect(f.ask).toEqual({ scope: 'jogos', niches: ['jogos'] })
    expect(f.niches[0]!.emptyText).toBe('Ainda não há leitura de padrões de título dos outliers de Jogos.')
  })
  it('nicho sem concorrentes: botão desabilitado com "Nenhum concorrente em Pessoal ainda" e nada a pedir', () => {
    for (const s of ['canais', 'mudancas', 'outliers', 'insights'] as const) {
      const f = buildForjaView(obs4, { screen: s, niche: 'pessoal' })
      expect([s, f.button.mode, f.button.disabledText, f.ask]).toEqual([s, 'disabled', 'Nenhum concorrente em Pessoal ainda', null])
    }
  })
  it('com os dois de fábrica nada muda: IA e Viagem, botão livre', () => {
    const f = buildForjaView(obs2, { screen: 'canais', niche: 'todos' })
    expect(f.niches.map(b => b.niche)).toEqual(['ia', 'viagem'])
    expect(f.ask).toEqual({ scope: 'todos', niches: ['ia', 'viagem'] })
  })
  it('o aviso do cabeçalho de Canais lista os nichos pedidos pelo rótulo, na ordem das abas', async () => {
    const user = userEvent.setup()
    const onAskForja = vi.fn(async () => ({ ok: true, reason: null, results: [] }))
    render(<ObservatoryChrome view={buildChromeView(obs3, { tab: 'canais', niche: 'todos', forja: buildForjaView(obs3, { screen: 'canais', niche: 'todos' }) })} onAskForja={onAskForja}><div>tela</div></ObservatoryChrome>)
    await user.click(screen.getByRole('button', { name: /Pedir (nova )?leitura à forja/ }))
    await waitFor(() => expect(onAskForja).toHaveBeenCalledTimes(3))
    expect(onAskForja.mock.calls.map(c => (c as unknown[])[1])).toEqual(['ia', 'viagem', 'jogos'])
    await waitFor(() => expect(screen.getByText('Pedido enviado à forja: 3 pedidos, um por nicho (Viagem, IA e Jogos)')).toBeTruthy())
  })
})

describe('Insights', () => {
  const NO_THEMES = 'Ainda não há lista de temas para Jogos. Padrões de título, o mapa de publicação e “Você no nicho” funcionam normalmente.'
  it('nicho criado: Temas e Lacunas dizem que não há lista de temas, sem selo da forja; Fórmulas só com as universais', () => {
    const v = buildInsightsView(obs3, { niche: 'jogos' })
    expect(v.themes).toMatchObject({ noThemes: NO_THEMES, seal: null, rows: [], empty: null })
    expect(v.gaps).toMatchObject({ noThemes: NO_THEMES, rows: [], empty: null, noRef: null })
    expect(v.themes!.meta).toBe('longos de Jogos, 90 dias vs os 90 anteriores')
    const ids = [...(v.formulas?.rows ?? []).map(r => r.id), ...(v.formulas?.zero?.ids ?? [])]
    for (const id of ids) expect(['preco', 'numero', 'pergunta', 'superlativo', 'primeira-pessoa']).toContain(id)
    const { container } = render(<InsightsScreen view={v} />)
    const blocks = [...container.querySelectorAll('[data-no-themes]')]
    expect(blocks.map(b => b.closest('section')!.id).sort()).toEqual(['gapCard', 'themeCard'])
    expect(blocks.map(b => b.textContent)).toEqual([NO_THEMES, NO_THEMES])
    expect(container.querySelector('#themeCard .stamp')).toBeNull()
    expect(junk(container)).toBeNull()
  })
  it('os de fábrica não ganham o bloco "sem lista de temas"', () => {
    const v = buildInsightsView(obs3, { niche: 'viagem' })
    expect(v.themes!.noThemes).toBeNull()
    expect(v.gaps!.noThemes).toBeNull()
  })
  it('nicho recém-criado (sem concorrentes, sem canal seu): cada card diz o que falta e nada quebra', () => {
    const v = buildInsightsView(obs4, { niche: 'pessoal' })
    expect(v.forja.button).toMatchObject({ mode: 'disabled', disabledText: 'Nenhum concorrente em Pessoal ainda' })
    expect(v.cadence!.empty).toBe('Nenhum canal concorrente em Pessoal.')
    // o herói diz o que falta (sem concorrente não há o que a forja ler) e aponta para o editor de nicho dos concorrentes
    expect(v.hero!.box).toEqual({ title: 'Ainda não há leitura dos longos de Pessoal', steps: false, stillNone: null,
      paras: ['Nenhum concorrente em Pessoal ainda: sem referência para comparar.'], link: { href: obs4.link.canais({ nicheEditor: 1 }), text: 'Definir nicho dos concorrentes' } })
    expect(v.themes!.noThemes).toContain('Pessoal')
    const { container } = render(<InsightsScreen view={v} />)
    expect(junk(container)).toBeNull()
    expect(container.textContent).toContain('Pessoal')
    expect(within(container.querySelector<HTMLElement>('.statebox')!).getByRole('link', { name: 'Definir nicho dos concorrentes' })).toBeTruthy()
  })
  it('nicho com concorrente e sem leitura: o herói continua com o texto de sempre (sem o atalho)', () => {
    const b = buildInsightsView(obs3, { niche: 'jogos' }).hero!.box!
    expect(b.title).toBe('Ainda não há leitura dos longos de Jogos')
    expect(b.link).toBeUndefined()
    expect(b.paras[1]).toBe('Roda na máquina local, com Gemma 12B. Não julga thumbnails nem afirma causa.')
  })
  it('Todos com nicho criado: "Misturar nichos…", um atalho por nicho e "…em nenhum nicho."', () => {
    const a = buildInsightsView(obs3, { niche: 'todos' }).all!
    expect(a.text).toMatch(/^Misturar nichos somaria públicos, horários e fórmulas que não têm nada a ver\./)
    expect(a.go.map(g => [g.niche, g.label, g.href])).toEqual([['viagem', 'Ver Viagem', '?niche=viagem'], ['ia', 'Ver IA', '?niche=ia'], ['jogos', 'Ver Jogos', '?niche=jogos']])
    // sem leitura nem pedido nenhum: a frase que conta nichos deixa de dizer "dois"
    const none = buildInsightsView(createObservatory({ ...D3.ds, readings: [], requests: [] }), { niche: 'todos' }).all!
    expect(none.forja.note).toBe('Ainda não há leitura dos longos em nenhum nicho.')
  })
  it('Todos só com os de fábrica: o texto de hoje, byte a byte', () => {
    const ds = datasetFromOracle(O)
    const a = buildInsightsView(createObservatory({ ...ds, readings: [], requests: [] }), { niche: 'todos' }).all!
    expect(a.text).toBe('Misturar viagem e IA somaria públicos, horários e fórmulas que não têm nada a ver. Escolha um nicho para ver a leitura da forja, as fórmulas e os temas. Pedir uma leitura daqui envia um pedido dos longos para cada nicho.')
    expect(a.go.map(g => g.label)).toEqual(['Ver Viagem', 'Ver IA'])
    expect(a.forja.note).toBe('Ainda não há leitura dos longos em nenhum dos dois nichos.')
  })
})

describe('Mudanças e Outliers num nicho criado', () => {
  it('Mudanças em Jogos: monta sem lançar e sem texto quebrado', () => {
    const v = buildMudancasView(obs3, { niche: 'jogos' }, new Set<string>())
    expect(JSON.stringify(v)).not.toMatch(/undefined|NaN/)
    expect(v.forja.niche).toBe('jogos')
  })
  it('Outliers em Jogos: o nicho da URL vale; um nicho desconhecido é dito como filtro inválido', () => {
    const v = buildOutliersView(obs3, { niche: 'jogos' })
    expect(v.query.niche).toBe('jogos')
    expect(JSON.stringify(v)).not.toMatch(/undefined|NaN/)
    const bad = buildOutliersView(obs3, { niche: 'sumiu' })
    expect(bad.query.niche).toBe('todos')
  })
})
