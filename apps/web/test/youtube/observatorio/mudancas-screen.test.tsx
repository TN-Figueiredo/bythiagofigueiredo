// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { MudancasScreen, type MudancasScreenProps } from '@/app/cms/(authed)/youtube/competitors/_mudancas/mudancas-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks } from './audits'

const replace = vi.fn(), refresh = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/mudancas',
  useSearchParams: () => new URLSearchParams(search),
}))

const obs = createObservatory(datasetFromOracle(loadOracle()))
const view = (p: Record<string, string> = {}, saved = new Set<string>()) => buildMudancasView(obs, p, saved)

function mount(props: Partial<MudancasScreenProps> = {}, p: Record<string, string> = {}) {
  return render(<div data-obs=""><ToastProvider><MudancasScreen view={view(p)} {...props} /></ToastProvider></div>)
}

beforeEach(() => { replace.mockReset(); refresh.mockReset(); search = '' })
afterEach(() => document.getElementById('flut')?.remove())

describe('MudancasScreen', () => {
  it('passes the DOM audits; no filled button (the forja is outlined here)', () => {
    const { container } = mount()
    expect(noJunkText(container)).toEqual([])
    expect(oneFilledButton(container)).toEqual([])
    expect(container.querySelectorAll('.btn-primary,.btn-forja-solid,.forja-solid')).toHaveLength(0)
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
  })
  it('"Mais filtros" abre em #flut, mantém os controles e Esc devolve o foco ao botão', () => {
    const { container } = mount()
    const btn = container.querySelector<HTMLButtonElement>('.filters .more-btn')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const pop = document.querySelector('#flut .mu-more-pop')!
    expect(pop.querySelector('#mu-fChannel')).not.toBeNull()
    expect(pop.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    fireEvent.mouseDown(pop.querySelector('#mu-fChannel')!)
    expect(document.querySelector('#flut .mu-more-pop')).not.toBeNull()
    fireEvent.keyDown(pop.querySelector('#mu-fChannel')!, { key: 'Escape' })
    expect(document.querySelector('#flut .mu-more-pop')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
  it('every interactive element has an accessible name', () => {
    const { container } = mount()
    const els = container.querySelectorAll('[data-obs-screen] :is(button, a[href], select, input, summary)')
    expect(els.length).toBeGreaterThan(20)
    els.forEach(el => expect(el).toHaveAccessibleName(/\S/))
  })
  it('first page shows whole video groups; "Carregar mais" reveals the rest', async () => {
    const user = userEvent.setup()
    const v = view(), { container } = mount()
    expect(container.querySelectorAll('[data-hero]')).toHaveLength(v.paging.cuts[0]!)
    expect(screen.getByText(v.paging.restTexts[0]!)).toBeInTheDocument()
    while (screen.queryByRole('button', { name: 'Carregar mais' })) await user.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(container.querySelectorAll('[data-hero]')).toHaveLength(18)
    expect(screen.getByText('Fim da lista')).toBeInTheDocument()
  })
  it('title diff gives screen-reader text per segment', () => {
    const { container } = mount()
    const srs = [...container.querySelectorAll('[data-title-diff] .sr')].map(s => s.textContent)
    expect(srs.length).toBeGreaterThan(0)
    for (const t of srs) expect(t).toMatch(/^ \((saiu|entrou|mudou de lugar|só maiúsculas\/minúsculas)\)$/)
  })
  it('every verdict says "Não prova causa"; inconclusive demotes the number by token, never opacity', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    while (screen.queryByRole('button', { name: 'Carregar mais' })) await user.click(screen.getByRole('button', { name: 'Carregar mais' }))
    const verdicts = container.querySelectorAll('.verdict:not(.wait)')
    expect(verdicts.length).toBeGreaterThan(0)
    for (const vd of verdicts) expect(vd.parentElement!.textContent).toMatch(/Não prova causa/)
    const inc = container.querySelectorAll('.verdict[data-status="inconclusivo"]')
    expect(inc.length).toBeGreaterThan(0)
    for (const vd of inc) expect(vd.parentElement!.querySelector('dd.inc[data-demoted]')).not.toBeNull()
    container.querySelectorAll<HTMLElement>('*').forEach(el => expect(el.style.opacity).toBe(''))
    const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_mudancas/mudancas.css'), 'utf8')
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/opacity/)
  })
  it('aguardando shows the engine waitText, never numbers', () => {
    const { container } = mount()
    const waits = container.querySelectorAll('.verdict.wait')
    expect(waits.length).toBeGreaterThan(0)
    for (const w of waits) {
      expect(w.textContent).toMatch(/^Aguardando: \d de 7 dias coletados/)
      expect(w.parentElement!.querySelector('.eff-dl')).toBeNull()
    }
  })
  it('thumbnails without an archived image say it honestly', () => {
    const { container } = mount({}, { type: 'thumb' })
    const missing = [...container.querySelectorAll('[data-thumb-missing]')].map(x => x.textContent)
    expect(missing.length).toBeGreaterThan(0)
    expect(missing.some(t => t!.includes('Trocas antes de ' + obs.SERIES_START_LABEL + ' não têm a imagem antiga'))).toBe(true)
    expect(container.querySelector('[data-thumb] img')).toBeNull()
  })
  it('description diff hides UTM noise behind "Mostrar ruído (UTM)"', async () => {
    const user = userEvent.setup()
    const { container } = mount({}, { type: 'desc', win: '90' })
    const box = container.querySelector('[data-desc-diff]')
    expect(box).not.toBeNull()
    const noisy = [...container.querySelectorAll('[data-desc-diff]')].find(d => d.querySelector('.ln.nz'))
    expect(noisy).toBeDefined()
    expect(noisy!.classList.contains('show-noise')).toBe(false)
    await user.click(within(noisy as HTMLElement).getByLabelText('Mostrar ruído (UTM)'))
    expect(noisy!.classList.contains('show-noise')).toBe(true)
  })
  it('swipe file toggles with the canonical toasts and the action key', async () => {
    const user = userEvent.setup()
    const onToggleSwipe = vi.fn().mockResolvedValueOnce({ ok: true, saved: true }).mockResolvedValueOnce({ ok: true, saved: false })
    mount({ onToggleSwipe })
    const btn = screen.getAllByRole('button', { name: 'Salvar no swipe file' })[0]!
    await user.click(btn)
    expect(onToggleSwipe).toHaveBeenCalledWith(view().heroes[0]!.swipe.key)
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'))
    // the accessible name is stable; only aria-pressed (and the visible title) carry the state
    expect(btn).toHaveAccessibleName('Salvar no swipe file')
    expect(btn).toHaveAttribute('title', 'Salvo no swipe file')
    expect(await screen.findByText('Salvo no swipe file', { selector: 'b' })).toBeInTheDocument()
    await user.click(btn)
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'))
    expect(await screen.findByText('Tirado do swipe file', { selector: 'b' })).toBeInTheDocument()
  })
  it('a failed swipe reverts and says so', async () => {
    const user = userEvent.setup()
    mount({ onToggleSwipe: vi.fn().mockResolvedValue({ ok: false }) })
    const btn = screen.getAllByRole('button', { name: 'Salvar no swipe file' })[0]!
    await user.click(btn)
    expect(await screen.findByText('Não deu para salvar no swipe file')).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })
  it('filters write the URL (window, type)', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: '7 d' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/mudancas?win=7', { scroll: false })
    await user.click(screen.getByRole('button', { name: /^Thumbnail/ }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/mudancas?type=thumb', { scroll: false })
  })
  it('empty with a local filter names the filter and offers to clear it', async () => {
    const user = userEvent.setup()
    search = 'q=zzzz'
    const { container } = mount({}, { q: 'zzzz' })
    const empty = container.querySelector('[data-empty]')!
    expect(empty.textContent).toMatch(/a busca “zzzz” esconde todas as 18/)
    expect(empty.textContent).not.toMatch(/não mexeram/)
    await user.click(within(empty as HTMLElement).getByRole('button', { name: 'Limpar a busca (18)' }))
    expect(replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/mudancas', { scroll: false })
  })
  it('the ledger closes the account and the median needs n ≥ 5', () => {
    const { container } = mount()
    expect(container.querySelector('[data-ledout]')!.textContent).toMatch(/Total: 4 nas medianas \+ 14 fora = 18 trocas na janela\./)
    for (const tr of container.querySelectorAll('[data-ledger] tbody tr')) {
      const n = Number(tr.querySelector('td.r .num')!.textContent)
      if (n < 5) { expect(tr.querySelectorAll('td.r')[1]!.textContent).toBe('—'); expect(tr.querySelector('.read')!.textContent).toMatch(/pouco para concluir/) }
    }
  })
  it('?reading= keeps the same list', () => {
    const a = mount().container
    const ids = [...a.querySelectorAll('[data-hero]')].map(x => x.getAttribute('data-id'))
    const b = mount({}, { reading: 'resumo-trocas-ia-20-10' }).container
    expect([...b.querySelectorAll('[data-hero]')].map(x => x.getAttribute('data-id'))).toEqual(ids)
  })
  it('a change without a swipe key renders a disabled button and never calls the action (R41)', async () => {
    const user = userEvent.setup()
    const onToggleSwipe = vi.fn()
    const v0 = view(), id = v0.heroes[0]!.id
    const { container } = render(<div data-obs=""><ToastProvider><MudancasScreen view={buildMudancasView(obs, {}, new Set(), new Map([[id, null]]))} onToggleSwipe={onToggleSwipe} /></ToastProvider></div>)
    const btn = container.querySelector(`[data-id="${id}"] button.save`) as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'Esta troca antiga não pode ir para o swipe file por aqui')
    await user.click(btn)
    expect(onToggleSwipe).not.toHaveBeenCalled()
    expect(screen.queryByText(/Tente de novo/)).toBeNull()
  })
})
