// @vitest-environment jsdom
// A5 2ª leva, T9: a barra de ordenação fixa dos cartões (celular). Só dado sintético.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, fireEvent, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { a3World } from './a3-fixture'
import { medidasDoMotor } from './canais-e5a-fixture'
import { buildCanaisView, type CanaisParams } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))
// Re-revisão C3: nenhum teste deste arquivo passa em verde sem afirmar.
beforeEach(() => { expect.hasAssertions(); replace.mockReset(); document.getElementById('flut')?.remove() })

const CSS = readFileSync(resolve(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_canais/canais.css'), 'utf8')
const ok = async () => ({ ok: true })
function montar(p: Partial<CanaisParams> = {}) {
  const { obs } = a3World()
  const v = buildCanaisView(obs, { niche: 'todos', limit: 75, fmt: 'longos', layout: 'cards', medidas: medidasDoMotor(obs), ...p })
  return render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><CanaisScreen view={v} canUnlock={false} onAdd={ok} onPedir={ok} onApagar={ok} onDesfazer={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} /></div></ChromeSyncContext.Provider></ToastProvider>)
}

describe('barra de ordenação', () => {
  it('7 botões na ordem do mockup, o ativo com ↓ visual, nome "maior primeiro" e aria-pressed', () => {
    montar({ sort: 'subs', dir: 'desc' })
    const bar = screen.getByTestId('canais-sortbar')
    const botoes = within(bar).getAllByRole('button')
    expect(botoes.map(b => b.textContent)).toEqual(['Inscritos ↓', 'Views/dia', 'Crescimento', 'Direção', 'Ritmo', 'Outliers', 'Trocas'])
    const ativo = within(bar).getByRole('button', { name: /Inscritos, maior primeiro/ })
    expect(ativo.getAttribute('aria-pressed')).toBe('true')
    expect(ativo.querySelector('[aria-hidden="true"]')!.textContent).toBe(' ↓')
    expect(within(bar).getByRole('button', { name: 'Direção' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('role="group" com aria-label "Ordenar canais" (não toolbar: sem setas de teclado)', () => {
    montar()
    const bar = screen.getByTestId('canais-sortbar')
    expect(bar.getAttribute('role')).toBe('group')
    expect(bar.getAttribute('aria-label')).toBe('Ordenar canais')
  })
  it('estrutura: a barra é irmã imediata da lista de cartões e nenhum ancestral até a tela cria rolagem', () => {
    montar()
    const bar = screen.getByTestId('canais-sortbar')
    const cartoes = document.querySelector('.cards')!
    expect(bar.nextElementSibling === cartoes || cartoes.nextElementSibling === bar).toBe(true)
    expect(bar.closest('.cardsort')).toBeNull()
    const regras = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ seletores: m[1]!.split(',').map(x => x.trim()), corpo: m[2]! }))
    let ancestrais = 0
    for (let el: Element | null = bar.parentElement; el && !el.hasAttribute('data-obs-screen'); el = el.parentElement) {
      ancestrais++
      for (const c of Array.from(el.classList)) {
        for (const r of regras) {
          const ultima = (sel: string) => sel.split(/[\s>+~]+/).pop() ?? ''
          if (!r.seletores.some(sel => ultima(sel).includes('.' + c))) continue
          expect(r.corpo, `.${c} cria rolagem e quebra o sticky`).not.toMatch(/overflow(-x|-y)?\s*:\s*(auto|hidden|scroll|clip)/)
        }
      }
    }
    expect(ancestrais).toBeGreaterThan(0)
  })
  it('CSS: --obs-top e --obs-topbar-h no escopo canais (52 px; 48 px até 768 px), barra escopada e presa, 44 px no toque, sem color-mix', () => {
    expect(CSS).toMatch(/\[data-obs-screen="canais"\]\s*\{[^}]*--obs-topbar-h:\s*52px[^}]*--obs-top:\s*calc\(var\(--obs-sticky-h,\s*0px\)\s*\+\s*var\(--obs-topbar-h\)\)/)
    expect(CSS).toMatch(/@media \(max-width:\s*768px\)\s*\{[^}]*\[data-obs-screen="canais"\]\s*\{[^}]*--obs-topbar-h:\s*48px/)
    expect(CSS).toMatch(/\[data-obs-screen="canais"\] \.sortbar\s*\{[^}]*position:\s*sticky[^}]*top:\s*var\(--obs-top\)/)
    expect(CSS).toMatch(/@media \(pointer:\s*coarse\)\s*\{[^}]*\.sortbar \.btn\s*\{[^}]*min-height:\s*44px/)
    // Gio F1: 2 linhas a 390 px (<= 112 px): padding da barra como o mockup (6px 0) e botões de 10 px de lado
    expect(CSS).toMatch(/\[data-obs-screen="canais"\] \.sortbar\s*\{[^}]*padding:\s*6px 0[;\s}]/)
    expect(CSS).toMatch(/\.sortbar \.btn\s*\{[^}]*padding-inline:\s*10px/)
    expect(CSS.slice(CSS.indexOf('A5 2ª leva, T9'))).not.toMatch(/color-mix/) // as regras da barra; o resto do arquivo é anterior a esta leva
  })
  it('tocar o ativo inverte; tocar outro abre do maior', () => {
    montar({ sort: 'subs', dir: 'desc' })
    fireEvent.click(screen.getByRole('button', { name: /Inscritos/ }))
    expect(String(replace.mock.calls.at(-1)![0])).toMatch(/sort=subs/)
    expect(String(replace.mock.calls.at(-1)![0])).toMatch(/dir=asc/)
    fireEvent.click(screen.getByRole('button', { name: 'Direção' }))
    const url = String(replace.mock.calls.at(-1)![0])
    expect(url).toMatch(/sort=direcao/)
    expect(url).not.toMatch(/dir=asc/)
  })
  it('o select antigo saiu e a barra não existe na tabela', () => {
    const c = montar()
    expect(document.querySelector('select[name="cardSort"]')).toBeNull()
    c.unmount()
    montar({ layout: 'table' })
    expect(screen.queryByTestId('canais-sortbar')).toBeNull()
  })
})
