// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks } from './audits'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))

const oracle = loadOracle()
const obs = createObservatory(datasetFromOracle(oracle))
const PICK = {
  full: 'matt-opus55', pre: 'nate-ai-agent-business', few: 'matt-fast-cheap', none: 'matt-gpt6-astra', noreg: 'paddy-doyle-l0',
  untr: 'luke-damant-l71', old: 'preguica-hailuo', err: 'esq-lawsuit', bf: 'vou-sem-volta-s0',
} as const

function mount(id: string, p: Record<string, string | undefined> = {}, o = obs) {
  const view = buildHistoricoView(o, id, p)
  const r = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
  return { ...r, view, root: r.container.querySelector('[data-obs-screen="historico"]')! }
}

describe('HistoricoScreen', () => {
  it.each(Object.entries(PICK))('state %s renders and passes the DOM audits', (k, id) => {
    const { root } = mount(id, { from: 'outliers' })
    expect(root.getAttribute('data-state')).toBe(k)
    expect(noJunkText(root)).toEqual([])
    expect(oneFilledButton(root)).toEqual([])
    expect(forbiddenVocabulary(root)).toEqual([])
    expect(brokenLinks(root)).toEqual([])
    // Task 35: the forja is the screen's single filled button (solid) in the video header
    const btns = [...root.querySelectorAll('.vhead .actions button')]
    expect(btns.map(b => b.id)).toEqual(['askForja'])
    expect(btns[0]).toHaveClass('forja-solid')
    expect(btns[0]!.textContent).toMatch(/Pedir (nova )?leitura à forja|Pedido em andamento/)
    // R43: no per-video swipe in the header (follow-up FU-2): no control that does nothing
    expect(root.textContent).not.toMatch(/swipe file/i)
  })

  it('every interactive element has an accessible name', () => {
    const { root } = mount(PICK.full)
    for (const el of root.querySelectorAll('button,a[href],input,summary')) {
      const name = (el.getAttribute('aria-label') ?? '') + (el.textContent ?? '') + (el.closest('label')?.textContent ?? '')
      expect([el.outerHTML.slice(0, 80), name.trim().length > 0]).toEqual([el.outerHTML.slice(0, 80), true])
    }
  })

  it('the curve is drawn in steps; the expected curve is dashed in --muted, never the forja colour', () => {
    const { root } = mount(PICK.full)
    const curve = root.querySelector('path[data-curve]')!
    // a step path: every segment is either horizontal or vertical (H → V pairs)
    const pts = [...curve.getAttribute('d')!.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])])
    for (let i = 1; i < pts.length; i++) expect(pts[i]![0] === pts[i - 1]![0] || pts[i]![1] === pts[i - 1]![1]).toBe(true)
    const exp = root.querySelector('path[data-expected]')!
    expect(exp.getAttribute('stroke')).toBe('var(--muted)')
    expect(exp.getAttribute('stroke-dasharray')).toBe('5 4')
    expect(root.innerHTML).not.toMatch(/stroke="var\(--forja/)
  })

  it('few records: no curve, the honest empty text', () => {
    const { root } = mount(PICK.few)
    expect(root.querySelector('svg.hv-chart')).toBeNull()
    expect(root.querySelector('[data-empty-chart]')!.textContent).toMatch(/^Ainda não há curva: só 1 registro diário\./)
  })

  it('old video: the period before the series start is compressed', () => {
    const { root } = mount(PICK.pre)
    expect(root.querySelector('svg.hv-chart')!.textContent).toContain('comprimidos,')
    expect(root.querySelector('[data-legend]')!.textContent).toMatch(/dias antes de 03\/10 comprimidos à esquerda/)
  })

  it('lanes: windows and markers name the change with the participle of the type', () => {
    const { root } = mount(PICK.full)
    expect(within(root.querySelector('[data-lane="title"]') as HTMLElement).getByRole('button', { name: 'Título trocado entre 11/10 06h e 12h' })).toBeTruthy()
    expect(within(root.querySelector('[data-lane="thumb"]') as HTMLElement).getByRole('button', { name: 'Thumbnail trocada em 13/10 09:40' })).toBeTruthy()
    expect(root.querySelectorAll('[data-lane="title"] .win').length).toBe(2)
  })

  it('focusing a marker shows the tooltip with before → after', async () => {
    const { root } = mount(PICK.full)
    const mk = within(root.querySelector('[data-lane="title"]') as HTMLElement).getByRole('button', { name: 'Título trocado entre 11/10 06h e 12h' })
    fireEvent.focus(mk)
    const tip = root.querySelector('#hv-tip')!
    await waitFor(() => expect(tip.classList.contains('show')).toBe(true))
    expect(tip.querySelector('h4')!.textContent).toBe('Título: T1 → T2')
    fireEvent.blur(mk)
    await waitFor(() => expect(tip.classList.contains('show')).toBe(false))
  })

  it('choosing a change shows its comparison (chips are toggle buttons)', () => {
    const { root, view } = mount(PICK.full)
    const chips = [...root.querySelectorAll<HTMLButtonElement>('.pair')]
    expect(chips.length).toBe(view.comparisons.length)
    expect(chips.filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.dataset.k)).toEqual([view.defaultPair])
    const other = chips.find(c => c.dataset.k !== view.defaultPair)!
    fireEvent.click(other)
    expect(other.getAttribute('aria-pressed')).toBe('true')
    const cmp = view.comparisons.find(c => c.changeId === other.dataset.k)!
    const box = root.querySelector('#hv-compare')!
    expect(box.textContent).toContain(cmp.full ? cmp.full.verdictStrong : cmp.nobase!.strong)
  })

  it('thumbnails: the archived blob as <img>, otherwise the honest text (no drawn stand-in)', () => {
    const { root } = mount(PICK.full)
    expect(root.querySelectorAll('img').length).toBe(0)
    expect(root.querySelector('.fcard [data-thumb-missing]')!.textContent).toBe('A imagem desta versão não foi arquivada.')
    const ds = datasetFromOracle(oracle)
    for (const t of ds.videos.find(x => x.id === PICK.full)!.thumbs) t.blobUrl = 'https://blob.example/' + t.key + '.jpg'
    const r2 = mount(PICK.full, {}, createObservatory(ds))
    expect([...r2.root.querySelectorAll('.fcard img')].map(i => i.getAttribute('src'))).toEqual(['A', 'B', 'A', 'C'].map(k => 'https://blob.example/' + k + '.jpg'))
  })

  it('pager rebuilds the origin list (from, back, ids)', () => {
    const ids = [PICK.none, PICK.full, PICK.few]
    const { root } = mount(PICK.full, { from: 'mudancas', ids: ids.join(','), back: '?niche=ia' })
    const prev = root.querySelector('[data-pager-prev]')!, next = root.querySelector('[data-pager-next]')!
    expect(prev.getAttribute('href')).toBe(obs.link.historico(PICK.none, { from: 'mudancas', ids, back: '?niche=ia' }))
    expect(next.getAttribute('href')).toBe(obs.link.historico(PICK.few, { from: 'mudancas', ids, back: '?niche=ia' }))
    expect(root.querySelector('[data-pager-pos]')!.textContent).toBe('vídeo 2 de 3 em Mudanças, na ordem da lista aberta')
    expect(root.querySelector('[data-crumb]')!.getAttribute('href')).toBe('/cms/youtube/competitors/mudancas?niche=ia')
  })

  it('an unknown id renders the not-found state', () => {
    const { root } = mount('sumiu')
    expect(root.querySelector('[data-not-found]')!.textContent).toMatch(/^Vídeo não encontrado: “sumiu”\./)
    expect(screen.getByRole('link', { name: 'Voltar para Mudanças' })).toBeTruthy()
  })

  it('untracked video: no curve nor versions, link to the channel', () => {
    const { root } = mount(PICK.untr)
    expect(root.querySelector('.timeline')).toBeNull()
    expect(root.querySelector('[data-untracked]')!.textContent).toMatch(/^Vídeo fora dos acompanhados\./)
  })

  it('a video of another niche toasts "Nicho mudou para …"', async () => {
    mount(PICK.noreg, { niche: 'ia' })
    await waitFor(() => expect(screen.getByText('Nicho mudou para Viagem para mostrar este vídeo')).toBeTruthy())
  })

  it('descriptions: line-by-line comparison hides UTM-only changes until asked', () => {
    const { root } = mount(PICK.full)
    const diff = root.querySelector('#hv-desc .diff')!
    expect(diff.classList.contains('shownoise')).toBe(false)
    fireEvent.click(within(root.querySelector('#hv-desc') as HTMLElement).getByRole('checkbox', { name: 'Ocultar mudanças só de link/UTM' }))
    expect(diff.classList.contains('shownoise')).toBe(true)
  })

  it('no number is computed in the screen: the components import no runtime from the engine', () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_historico')
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.tsx'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      expect([f, /from '@\/lib\/youtube\/observatorio[^']*'/.test(src.replace(/import type [^\n]+\n/g, ''))]).toEqual([f, false])
      expect([f, /toFixed|toLocaleString|\.fmt\.|Intl\./.test(src)]).toEqual([f, false])
    }
  })
})
