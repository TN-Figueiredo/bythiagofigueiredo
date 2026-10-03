// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
import type { OwnPreset } from '../../fixtures/observatorio/own-presets'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { noJunkText, oneFilledButton, linkCountsMatch, forbiddenVocabulary, brokenLinks } from './audits'

const replace = vi.fn(), refresh = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(search),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const view = (p: Partial<CanaisParams> = {}) => buildCanaisView(obs, { niche: 'todos', limit: 75, ...p })
const ok = async () => ({ ok: true })
function mount(props: Partial<CanaisScreenProps> = {}, p: Partial<CanaisParams> = {}, running = false) {
  // the screen lives inside the chrome, which owns the toasts
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div><CanaisScreen view={view(p)} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
/** Every "Ver os N…" link must say the count its destination shows. */
function destCounts() {
  const c: Record<string, number> = {}
  for (const ch of obs.channels) {
    c[`changes:${ch.id}`] = obs.changesIn({ channel: ch.id }).length
    for (const f of ['long', 'short'] as const) c[`outliers:${ch.id}:${f}`] = obs.outliers({ channel: ch.id, fmt: f, includeOwn: ch.own }).count
  }
  return c
}

/** The counter, as read (numbers in mono spans, joined by no-break spaces; the tooltip excluded). */
const quota = () => [...document.querySelector('.quota')!.childNodes].filter(n => !(n instanceof Element && n.classList.contains('tip'))).map(n => n.textContent).join('').replace(/\u00a0/g, ' ').trim()

beforeEach(() => { replace.mockReset(); refresh.mockReset(); search = '' })

describe('CanaisScreen', () => {
  it('passes the DOM audits; the only filled button is "Adicionar canal"', () => {
    const { container } = mount()
    expect(noJunkText(container)).toEqual([])
    expect(oneFilledButton(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
    const filled = container.querySelectorAll('.btn-primary')
    expect(filled).toHaveLength(1)
    expect(filled[0]!.textContent).toBe('Adicionar canal')
    expect(quota()).toBe('14 de 75 canais')
  })
  it('every drawer passes the audits and link counts match their destinations, on every tab', async () => {
    const user = userEvent.setup()
    for (const id of ['matt-wolfe', 'luke-damant', 'nomade-raiz', 'vou-sem-volta', 'esq-unltd-daily', 'bald-and-bankrupt', 'tnfigueiredo']) {
      const { container, unmount } = mount({}, { channel: id })
      const d = screen.getByRole('dialog', { name: obs.channel(id)!.name })
      for (const t of ['Trocas', 'Outliers', 'Vídeos']) {
        await user.click(within(d).getByRole('tab', { name: new RegExp('^' + t) }))
        expect(noJunkText(container)).toEqual([])
        expect(forbiddenVocabulary(container)).toEqual([])
        expect(linkCountsMatch(container, destCounts())).toEqual([])
        expect(brokenLinks(container)).toEqual([])
      }
      unmount()
    }
  }, 30_000) // 7 drawers x 3 tabs of jsdom renders + 4 audits each: ~0.9 s locally, ~5 s on the slower CI runner
  it('the stalled channel says "até o registro diário de DD/MM HH:MM"', () => {
    mount({}, { channel: 'bald-and-bankrupt' })
    expect(screen.getAllByText(/até o registro diário de \d\d\/\d\d \d\d:\d\d/).length).toBeGreaterThan(0)
  })
  it('full: "Adicionar canal" is disabled with the sentence of canais.html', async () => {
    const user = userEvent.setup()
    mount({}, { limit: 14 })
    expect(quota()).toBe('14 de 14 canais')
    const add = screen.getByText('Adicionar canal').closest('a')!
    expect(add).toHaveAttribute('aria-disabled', 'true')
    expect(add).not.toHaveAttribute('href')
    expect(add).toHaveAttribute('title', 'Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.')
    await user.click(add)
    expect(await screen.findByText('Sem vagas: 14 de 14 concorrentes. Remova um canal para adicionar outro.', { selector: '.obs-ch-toast b' })).toBeInTheDocument()
  })
  it('admin "+25" only for admins and only near the limit', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn(async () => ({ ok: true }))
    const { unmount } = mount({ canUnlock: true, onUnlock }, { limit: 16 })
    await user.click(screen.getByRole('button', { name: 'Destravar mais 25 vagas' }))
    expect(onUnlock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    unmount()
    const r2 = mount({ canUnlock: false }, { limit: 16 })
    expect(screen.queryByRole('button', { name: 'Destravar mais 25 vagas' })).toBeNull()
    r2.unmount()
    mount({ canUnlock: true }, { limit: 75 })
    expect(screen.queryByRole('button', { name: 'Destravar mais 25 vagas' })).toBeNull()
  })
  it('?add=1 opens the form; invalid input and a duplicate (with the niche) are rejected', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => ({ ok: false, error: 'Matt Wolfe já está no observatório (IA).' }))
    mount({ onAdd }, { add: '1' })
    const dlg = screen.getByRole('dialog', { name: 'Adicionar canal' })
    const input = within(dlg).getByLabelText('Canal do YouTube')
    expect(document.activeElement).toBe(input)
    await user.type(input, 'xx')
    await user.click(within(dlg).getByRole('button', { name: 'Adicionar canal' }))
    expect(within(dlg).getByText('Use o @handle (ex.: @LukeDamant) ou a URL do canal (youtube.com/@…).')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '@MattWolfe')
    await user.click(within(dlg).getByRole('button', { name: 'Adicionar canal' }))
    expect(onAdd).toHaveBeenCalledWith({ channel: '@MattWolfe', niche: 'viagem', videoLimit: 50 })
    expect(await within(dlg).findByText('Matt Wolfe já está no observatório (IA).')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Adicionar canal' })).toBeNull()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
  })
  it('?filter=problemas lists only channels in trouble and offers "Mostrar todos"', () => {
    mount({}, { filter: 'problemas' })
    const rows = [...document.querySelectorAll('tr.obs-cn-row')].map(r => r.getAttribute('data-id'))
    expect(rows).toEqual(expect.arrayContaining(['paddy-doyle', 'vou-sem-volta', 'esq-unltd-daily']))
    expect(rows).not.toContain('matt-wolfe')
    expect(screen.getByRole('link', { name: 'Mostrar todos' })).toHaveAttribute('href', '/cms/youtube/competitors')
  })
  it('drawer (below 1280 px = modal): Esc closes it and returns the focus to the row button', async () => {
    const user = userEvent.setup()
    mount({}, { channel: 'matt-wolfe' })
    const d = screen.getByRole('dialog', { name: 'Matt Wolfe' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Fechar detalhes do canal' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Matt Wolfe' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes de Matt Wolfe' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
  })
  it('drawer focus trap and tab keys', async () => {
    const user = userEvent.setup()
    mount({}, { channel: 'matt-wolfe' })
    const d = screen.getByRole('dialog', { name: 'Matt Wolfe' })
    const tabs = within(d).getAllByRole('tab')
    tabs[0]!.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    // Tab from the last focusable wraps to the first
    const f = [...d.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,input,[tabindex="0"]')].filter(x => !x.closest('[hidden]'))
    f[f.length - 1]!.focus()
    await user.tab()
    expect(document.activeElement).toBe(f[0])
  })
  it('opening a row puts ?channel= in the URL', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Abrir detalhes de Luke Damant' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?channel=luke-damant', { scroll: false })
  })
  it('removing asks first with the texts of canais.html, then calls the action', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn(async () => ({ ok: true }))
    mount({ onRemove })
    await user.click(screen.getByRole('button', { name: 'Mais ações para Luke Damant' }))
    await user.click(screen.getByRole('menuitem', { name: 'Remover canal…' }))
    const dlg = screen.getByRole('dialog', { name: 'Remover Luke Damant?' })
    expect(within(dlg).getByText('Não dá para desfazer. Se adicionar de novo, a coleta recomeça do zero.')).toBeInTheDocument()
    await user.click(within(dlg).getByRole('button', { name: 'Remover canal' }))
    expect(onRemove).toHaveBeenCalledWith('luke-damant')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
  it('changing a niche calls the action', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async () => ({ ok: true }))
    mount({ onSetNiche })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de Luke Damant' }), 'ia')
    expect(onSetNiche).toHaveBeenCalledWith('luke-damant', 'ia')
  })
  it('"Sincronizar só este canal" shows the in-progress state, then the result', async () => {
    const user = userEvent.setup()
    let done: (v: { ok: boolean }) => void = () => {}
    const onSyncOne = vi.fn(() => new Promise<{ ok: boolean }>(r => { done = r }))
    mount({ onSyncOne })
    await user.click(screen.getByRole('button', { name: 'Mais ações para Luke Damant' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sincronizar só este canal' }))
    expect(screen.getAllByText('Sincronizando agora').length).toBeGreaterThan(0)
    done({ ok: true })
    expect(await screen.findByText('Luke Damant sincronizado')).toBeInTheDocument()
  })
  it('while the chrome runs the round: the sync bar and "Na fila desta rodada"', () => {
    const { container, unmount } = mount({}, {}, true)
    const bar = container.querySelector('.syncbar')!
    expect(bar).toHaveClass('on')
    expect(within(bar as HTMLElement).getByText(/^Sincronização em andamento: 11 concorrentes na rodada/)).toBeInTheDocument()
    expect(screen.getAllByText('Na fila desta rodada').length).toBe(11)
    expect(noJunkText(container)).toEqual([])
    unmount()
    const r = mount()
    expect(r.container.querySelector('.syncbar')).not.toHaveClass('on')
    expect(screen.queryByText('Na fila desta rodada')).toBeNull()
  })
  it('niche editor (?nicheEditor=1): all competitors even in IA, focus on the first select, back to the opener on close', async () => {
    const user = userEvent.setup()
    const opener = document.createElement('button'); opener.textContent = 'abrir'; document.body.appendChild(opener); opener.focus()
    mount({}, { niche: 'ia', nicheEditor: '1' })
    const dlg = screen.getByRole('dialog', { name: 'Definir nicho dos canais' })
    const selects = within(dlg).getAllByRole('combobox')
    expect(selects).toHaveLength(14)
    expect(within(dlg).getByRole('combobox', { name: 'Nicho de Luke Damant' })).toBeInTheDocument()
    expect(document.activeElement).toBe(selects[0])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Definir nicho dos canais' })).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors', { scroll: false })
    opener.remove()
  })
  it('niche editor with no focused opener returns the focus to the chrome menu ⋯', async () => {
    const user = userEvent.setup()
    ;(document.activeElement as HTMLElement | null)?.blur()
    mount({}, { nicheEditor: '1' })
    await user.click(within(screen.getByRole('dialog', { name: 'Definir nicho dos canais' })).getByRole('button', { name: 'Fechar' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mais ações' }))
  })
})


// Task 35b (canais.html #scrollHint): the sideways-scroll hint appears only when the table really overflows
describe('CanaisScreen — scroll hint', () => {
  it('absent when the table fits; present when it overflows', () => {
    const { unmount } = mount()
    expect(document.querySelector('[data-scroll-hint]')).toBeNull()
    unmount()
    const sw = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200)
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700)
    try {
      mount()
      expect(screen.getByText('Role a tabela para o lado para ver todas as colunas.')).toBeInTheDocument()
    } finally { sw.mockRestore(); cw.mockRestore() }
  })
})

// Task 35b (canais.html:804-805): the drawer's Outliers tab keeps its intro for a channel still fetching videos
describe('CanaisScreen — drawer Outliers of a backfilling channel', () => {
  it('intro and the "Sem base de comparação ainda" note, both', () => {
    mount({}, { channel: 'vou-sem-volta', tab: 'outliers' })
    const panel = document.getElementById('cn-pOut')!
    expect(panel.textContent).toContain('Views do vídeo contra a mediana dos outros vídeos do canal na mesma idade')
    expect(panel.textContent).toContain('Sem base de comparação ainda: a busca tem 18 de 50 vídeos')
  })
})

// Plano "N canais próprios", Task 7: grupo "Seus canais", nicho editável nos canais próprios, chip de idioma
const engines = new Map<OwnPreset, ReturnType<typeof createObservatory>>()
const obsOf = (preset: OwnPreset) => { let o = engines.get(preset); if (!o) { o = createObservatory(datasetFromOracle(loadOracleOwns(preset))); engines.set(preset, o) } return o }
function mountOwns(preset: OwnPreset, props: Partial<CanaisScreenProps> = {}, p: Partial<CanaisParams> = {}) {
  const v = buildCanaisView(obsOf(preset), { niche: 'todos', limit: 75, ...p })
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div><CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} {...props} /></div></ChromeSyncContext.Provider></ToastProvider>)
}
const toastTitle = (t: string) => screen.findByText(t, { selector: '.obs-ch-toast b' })

describe('CanaisScreen — Seus canais', () => {
  it('preset 2: a linha do grupo "Seus canais" e duas linhas próprias, cada uma com chip de idioma e seletor de nicho', () => {
    const { container } = mountOwns('2')
    const group = container.querySelector('tr.group[data-own-group]')!
    expect(group.textContent).toContain('Seus canais')
    expect(group.querySelector('.num')!.textContent).toBe('2')
    expect(group.textContent).toContain('fora do limite de concorrentes')
    expect(group.querySelector('.dot')).toBeNull()
    const own = [...container.querySelectorAll('tr.you')]
    expect(own.map(r => r.querySelector('.nmbtn')!.textContent)).toEqual(['tnFigueiredo', 'tnFigueiredo EN'])
    expect(own.map(r => r.querySelector('abbr.langtag')!.textContent)).toEqual(['PT', 'EN'])
    expect(own.map(r => r.querySelector('abbr.langtag')!.getAttribute('title'))).toEqual(['Canal em português', 'Canal em inglês'])
    expect(own.map(r => r.querySelector('select')!.getAttribute('aria-label'))).toEqual(['Nicho de tnFigueiredo', 'Nicho de tnFigueiredo EN'])
    // the group line comes before the own rows, and these before the competitor groups
    const order = [...container.querySelectorAll('tbody > tr')]
    expect(order[0]).toBe(group)
    expect(order.slice(1, 3)).toEqual(own)
    for (const r of own) {
      expect(r.querySelectorAll('.ch .sub')).toHaveLength(2)
      expect(r.querySelector('.ch .sub .youtag')!.textContent).toBe('seu canal')
      expect(r.querySelector('.nmrow .nmbtn')!.getAttribute('title')).toBe(r.querySelector('.nmbtn')!.textContent)
      // own channels keep no ⋯ menu
      expect(r.querySelector('[data-menu]')).toBeNull()
    }
    expect(container.querySelector('.sortnote')!.textContent).toBe('Ordenado por Ritmo, maior primeiro; os seus canais ficam sempre no topo')
  })
  it('preset 1: sem linha de grupo, sem chip de idioma, e a linha própria tem o seletor de nicho', () => {
    const { container } = mountOwns('1')
    expect(container.querySelector('[data-own-group]')).toBeNull()
    expect(container.querySelector('.langtag')).toBeNull()
    const own = container.querySelectorAll('tr.you')
    expect(own).toHaveLength(1)
    expect(within(own[0] as HTMLElement).getByRole('combobox', { name: 'Nicho de tnFigueiredo' })).toHaveValue('viagem')
    // a competitor keeps one .sub line
    expect(container.querySelector('tr[data-id="luke-damant"]')!.querySelectorAll('.ch .sub')).toHaveLength(1)
  })
  it('canal próprio sem nicho: seletor tracejado pedindo o nicho, e o aviso na linha do grupo', () => {
    const { container } = mountOwns('mix')
    const sel = container.querySelector<HTMLSelectElement>('tr[data-id="mochila-leve"] select')!
    expect(sel).toHaveClass('niche', 'none')
    expect(sel.getAttribute('aria-label')).toBe('Nicho de Mochila Leve: sem nicho, escolha um')
    expect(sel.value).toBe('')
    const first = sel.options[0]!
    expect([first.textContent, first.value, first.disabled]).toEqual(['Escolher nicho', '', true])
    const flag = container.querySelector('tr[data-own-group] .flag')!
    expect(flag.textContent).toBe('1 sem nicho: escolha o nicho na linha do canal')
    expect(flag.querySelector('svg')).not.toBeNull()
    // a channel with a niche offers no empty option
    expect(container.querySelector<HTMLSelectElement>('tr[data-id="tnfigueiredo"] select')!.options).toHaveLength(2)
  })
  it('nicho que não tem canal seu: a linha do grupo aparece sozinha e diz onde eles estão', () => {
    const { container } = mountOwns('2', {}, { niche: 'ia' })
    expect(container.querySelectorAll('tr.you')).toHaveLength(0)
    const t = container.querySelector('tr[data-own-group]')!.textContent!
    expect(t).toContain('nenhum de IA')
    expect(t).toContain('2 em outro nicho (aparecem em Todos)')
  })
  it('site sem canal próprio: nenhuma linha de grupo, nenhuma linha própria, auditorias limpas', () => {
    const ds = datasetFromOracle(loadOracle())
    const owns = new Set(ds.channels.filter(c => c.own).map(c => c.id))
    ds.channels = ds.channels.filter(c => !c.own); ds.videos = ds.videos.filter(x => !owns.has(x.ch))
    const o = createObservatory(ds)
    for (const layout of ['table', 'cards']) {
      const { container, unmount } = render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={buildCanaisView(o, { niche: 'todos', limit: 75, layout })} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
      expect(container.querySelector('[data-own-group]')).toBeNull()
      expect(container.querySelector('.you')).toBeNull()
      expect(noJunkText(container)).toEqual([])
      unmount()
    }
  })
  it('trocar o nicho de um canal próprio chama onSetOwnNiche (não onSetNiche) e diz "definido como"; o foco fica no seletor', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async () => ({ ok: true })), onSetOwnNiche = vi.fn(async () => ({ ok: true }))
    mountOwns('2', { onSetNiche, onSetOwnNiche })
    const sel = screen.getByRole('combobox', { name: 'Nicho de tnFigueiredo' })
    await user.selectOptions(sel, 'ia')
    expect(onSetOwnNiche).toHaveBeenCalledWith('tnfigueiredo', 'ia')
    expect(onSetNiche).not.toHaveBeenCalled()
    expect(await toastTitle('Nicho de tnFigueiredo definido como IA')).toBeInTheDocument()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Nicho de tnFigueiredo' }))
    // Todos: nothing left the filter
    expect(screen.queryByText(/Ele saiu do filtro/)).toBeNull()
  })
  it('trocar o nicho de um concorrente chama onSetNiche e diz "alterado para"', async () => {
    const user = userEvent.setup()
    const onSetNiche = vi.fn(async () => ({ ok: true })), onSetOwnNiche = vi.fn(async () => ({ ok: true }))
    mountOwns('2', { onSetNiche, onSetOwnNiche }, { niche: 'viagem' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de Luke Damant' }), 'ia')
    expect(onSetNiche).toHaveBeenCalledWith('luke-damant', 'ia')
    expect(onSetOwnNiche).not.toHaveBeenCalled()
    expect(await toastTitle('Nicho de Luke Damant alterado para IA')).toBeInTheDocument()
    expect(screen.getByText('Ele saiu do filtro Viagem.')).toBeInTheDocument()
    // the row leaves on the refresh: the focus goes to the first row that stays (an own channel, on top)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes de tnFigueiredo' })))
  })
  it('falha: "Não deu para mudar o nicho", com o que continua valendo (nicho anterior ou sem nicho)', async () => {
    const user = userEvent.setup()
    const onSetOwnNiche = vi.fn(async () => ({ ok: false }))
    const r = mountOwns('mix', { onSetOwnNiche })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de tnFigueiredo' }), 'ia')
    expect(await toastTitle('Não deu para mudar o nicho')).toBeInTheDocument()
    expect(screen.getByText('tnFigueiredo continua no nicho anterior.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
    r.unmount()
    mountOwns('mix', { onSetOwnNiche })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de Mochila Leve: sem nicho, escolha um' }), 'viagem')
    expect(onSetOwnNiche).toHaveBeenLastCalledWith('mochila-leve', 'viagem')
    expect(await screen.findByText('Mochila Leve continua sem nicho.')).toBeInTheDocument()
  })
  it('a action que lança conta como falha (nada de sucesso inventado)', async () => {
    const user = userEvent.setup()
    mountOwns('2', { onSetOwnNiche: vi.fn(async () => { throw new Error('rede') }) })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nicho de tnFigueiredo' }), 'ia')
    expect(await toastTitle('Não deu para mudar o nicho')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('cards: o separador "Seus canais" e um card por canal próprio', () => {
    const { container } = mountOwns('2', {}, { layout: 'cards' })
    const sep = container.querySelector('.cardsep[data-own-group]')!
    expect(sep.querySelector('strong')!.textContent).toBe('Seus canais')
    expect(sep.textContent).toContain('fora do limite de concorrentes')
    const cards = [...container.querySelectorAll('article.card.you')]
    expect(cards.map(c => c.getAttribute('data-id'))).toEqual(['tnfigueiredo', 'tnfigueiredo-en'])
    for (const c of cards) {
      expect(c.querySelector('abbr.langtag')).not.toBeNull()
      expect(c.querySelector('select[data-ctx="card"]')).not.toBeNull()
      expect(c.querySelector('[data-menu]')).toBeNull()
    }
    const r1 = mountOwns('1', {}, { layout: 'cards' })
    expect(r1.container.querySelector('[data-own-group]')).toBeNull()
    expect(r1.container.querySelectorAll('article.card.you')).toHaveLength(1)
  })
  it('gaveta de canal próprio: "seu canal", o chip, o seletor de nicho e nenhum "Remover canal"', () => {
    mountOwns('2', {}, { channel: 'tnfigueiredo-en' })
    const d = screen.getByRole('dialog', { name: 'tnFigueiredo EN' })
    const meta = d.querySelector('.dhead .meta')!
    expect(meta.querySelector('.youtag')!.textContent).toBe('seu canal')
    expect(meta.querySelector('abbr.langtag')!.textContent).toBe('EN')
    const sel = meta.querySelector<HTMLSelectElement>('select[data-ctx="drawer"]')!
    expect(sel.getAttribute('aria-label')).toBe('Nicho de tnFigueiredo EN')
    expect(sel.value).toBe('viagem')
    expect(within(d).queryByRole('button', { name: 'Remover canal…' })).toBeNull()
    // the forja box stays out of an own channel's drawer
    expect(d.querySelector('.forjabox')).toBeNull()
  })
  it('gaveta de concorrente: só o seletor, sem "seu canal" nem chip', () => {
    mountOwns('2', {}, { channel: 'luke-damant' })
    const meta = screen.getByRole('dialog', { name: 'Luke Damant' }).querySelector('.dhead .meta')!
    expect(meta.querySelector('.youtag')).toBeNull()
    expect(meta.querySelector('.langtag')).toBeNull()
    expect(meta.querySelector('select[data-ctx="drawer"]')).not.toBeNull()
  })
  it('filtro Viagem, gaveta do canal próprio aberta: trocar para IA fecha a gaveta e tira ?channel= da URL', async () => {
    const user = userEvent.setup()
    const onSetOwnNiche = vi.fn(async () => ({ ok: true }))
    search = 'niche=viagem&channel=tnfigueiredo&tab=videos'
    mountOwns('2', { onSetOwnNiche }, { niche: 'viagem', nicheExplicit: true, channel: 'tnfigueiredo', tab: 'videos' })
    const d = screen.getByRole('dialog', { name: 'tnFigueiredo' })
    await user.selectOptions(d.querySelector<HTMLSelectElement>('select[data-ctx="drawer"]')!, 'ia')
    expect(onSetOwnNiche).toHaveBeenCalledWith('tnfigueiredo', 'ia')
    expect(await toastTitle('Nicho de tnFigueiredo definido como IA')).toBeInTheDocument()
    expect(screen.getByText('Ele saiu do filtro Viagem.')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?niche=viagem', { scroll: false })
    expect(screen.queryByRole('dialog', { name: 'tnFigueiredo' })).toBeNull()
    // the focus leaves the closed drawer for a row that stays in the filter
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir detalhes de tnFigueiredo EN' })))
  })
  it('trocar o nicho sem sair do filtro mantém a gaveta aberta', async () => {
    const user = userEvent.setup()
    search = 'channel=tnfigueiredo'
    mountOwns('2', {}, { channel: 'tnfigueiredo' })
    const d = screen.getByRole('dialog', { name: 'tnFigueiredo' })
    await user.selectOptions(d.querySelector<HTMLSelectElement>('select[data-ctx="drawer"]')!, 'ia')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'tnFigueiredo' })).toBeInTheDocument()
    expect(document.activeElement).toBe(d.querySelector('select[data-ctx="drawer"]'))
  })
  it('drawerDropped: a tela tira channel e tab da URL e não abre gaveta', () => {
    search = 'niche=ia&channel=luke-damant&tab=outliers'
    mountOwns('2', {}, { niche: 'ia', nicheExplicit: true, channel: 'luke-damant', tab: 'outliers' })
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors?niche=ia', { scroll: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('sem drawerDropped a URL fica como está', () => {
    search = 'niche=ia&channel=luke-damant'
    mountOwns('2', {}, { niche: 'ia', nicheExplicit: false, channel: 'luke-damant' })
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Luke Damant' })).toBeInTheDocument()
  })
  it('diálogo "Definir nicho dos canais": só concorrentes, com a frase nova', () => {
    mountOwns('2', {}, { nicheEditor: '1' })
    const dlg = screen.getByRole('dialog', { name: 'Definir nicho dos canais' })
    expect(within(dlg).getAllByRole('combobox')).toHaveLength(14)
    expect(within(dlg).getByText('O nicho decide em que grupo o canal aparece e com quem ele é comparado.')).toBeInTheDocument()
    expect(dlg.textContent).not.toContain('Seu canal não tem nicho aqui')
    expect(within(dlg).queryByRole('combobox', { name: 'Nicho de tnFigueiredo' })).toBeNull()
  })
  it('auditorias nos presets 1, 2, 5 e mix, em tabela, cards, Shorts e com a gaveta de um canal próprio', () => {
    for (const preset of ['1', '2', '5', 'mix'] as const) for (const p of [{}, { layout: 'cards' }, { fmt: 'short' }, { niche: 'viagem' as const }, { channel: 'tnfigueiredo' }]) {
      const { container, unmount } = mountOwns(preset, {}, p)
      expect(noJunkText(container)).toEqual([])
      expect(oneFilledButton(container)).toEqual([])
      expect(forbiddenVocabulary(container)).toEqual([])
      expect(brokenLinks(container)).toEqual([])
      unmount()
    }
  }, 30_000)
})

describe('CanaisScreen: nicho otimista', () => {
  type R = { ok: boolean }
  const deferred = () => { let res: (v: R) => void = () => {}, rej: (e: Error) => void = () => {}; const p = new Promise<R>((a, b) => { res = a; rej = b }); return { p, res, rej } }
  const sel = (name: string) => screen.getByRole('combobox', { name: `Nicho de ${name}` }) as HTMLSelectElement
  const toastBad = (t: string) => screen.findByText(t, { selector: '.obs-ch-toast b' })

  it('o seletor mostra o valor novo antes de a action resolver, com aria-busy', async () => {
    const user = userEvent.setup(), d = deferred()
    mount({ onSetNiche: vi.fn(() => d.p) })
    const before = sel('Luke Damant').value
    const next = before === 'ia' ? 'viagem' : 'ia'
    await user.selectOptions(sel('Luke Damant'), next)
    expect(sel('Luke Damant').value).toBe(next)
    expect(sel('Luke Damant')).toHaveAttribute('aria-busy', 'true')
    d.res({ ok: true })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(sel('Luke Damant').value).toBe(next)
    expect(sel('Luke Damant')).not.toHaveAttribute('aria-busy', 'true')
  })
  it('{ ok: false } devolve o valor anterior e mostra o aviso de erro', async () => {
    const user = userEvent.setup(), d = deferred()
    mount({ onSetNiche: vi.fn(() => d.p) })
    const before = sel('Luke Damant').value
    await user.selectOptions(sel('Luke Damant'), before === 'ia' ? 'viagem' : 'ia')
    d.res({ ok: false })
    expect(await toastBad('Não deu para mudar o nicho')).toBeInTheDocument()
    expect(sel('Luke Damant').value).toBe(before)
  })
  it('a action que lança devolve o valor anterior e mostra o aviso de erro', async () => {
    const user = userEvent.setup(), d = deferred()
    mount({ onSetNiche: vi.fn(() => d.p) })
    const before = sel('Luke Damant').value
    await user.selectOptions(sel('Luke Damant'), before === 'ia' ? 'viagem' : 'ia')
    d.rej(new Error('rede'))
    expect(await toastBad('Não deu para mudar o nicho')).toBeInTheDocument()
    expect(sel('Luke Damant').value).toBe(before)
  })
  it('dois canais pendentes ao mesmo tempo: cada um mostra o seu valor', async () => {
    const user = userEvent.setup(), a = deferred(), b = deferred()
    const onSetNiche = vi.fn((id: string) => (id === 'luke-damant' ? a.p : b.p))
    mount({ onSetNiche })
    const names = ['Luke Damant', 'Matt Wolfe']
    const before = names.map(n => sel(n).value), next = before.map(v => (v === 'ia' ? 'viagem' : 'ia'))
    await user.selectOptions(sel(names[0]!), next[0]!)
    await user.selectOptions(sel(names[1]!), next[1]!)
    expect(sel(names[0]!).value).toBe(next[0])
    expect(sel(names[1]!).value).toBe(next[1])
    b.res({ ok: false })
    await toastBad('Não deu para mudar o nicho')
    expect(sel(names[1]!).value).toBe(before[1])
    expect(sel(names[0]!).value).toBe(next[0])
    a.res({ ok: true })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(sel(names[0]!).value).toBe(next[0])
  })
  it('duas escolhas seguidas no mesmo canal: vale a última, mesmo se a primeira resolver depois', async () => {
    const user = userEvent.setup(), first = deferred(), second = deferred()
    const onSetNiche = vi.fn().mockReturnValueOnce(first.p).mockReturnValueOnce(second.p)
    mount({ onSetNiche })
    const before = sel('Luke Damant').value
    const other = before === 'ia' ? 'viagem' : 'ia'
    await user.selectOptions(sel('Luke Damant'), other)
    await user.selectOptions(sel('Luke Damant'), before)
    expect(sel('Luke Damant').value).toBe(before)
    second.res({ ok: true })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    first.res({ ok: false })
    await toastBad('Não deu para mudar o nicho')
    expect(sel('Luke Damant').value).toBe(before)
  })
})
