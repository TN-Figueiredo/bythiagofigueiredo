// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CelulaDica } from '@/app/cms/(authed)/youtube/competitors/_canais/celula-dica'
import { Popover } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/flut'

// Re-revisão C3: nenhum `it` deste arquivo pode passar em verde sem afirmar nada.
beforeEach(() => { expect.hasAssertions() })

// O jsdom do projeto (25.0.1) NÃO tem PointerEvent: sem isto o React recebe `e.pointerType === undefined` e o ramo de toque nunca roda (Yannis I3).
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PE extends MouseEvent { pointerType: string; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerType = i.pointerType ?? 'mouse' } }
    Object.defineProperty(window, 'PointerEvent', { value: PE, configurable: true })
  }
})

const dica = (t: string, v: string) => <CelulaDica texto={t}><b>{v}</b></CelulaDica>

describe('CelulaDica', () => {
  it('foco abre, Esc fecha; caixa com role tooltip ligada por aria-describedby', () => {
    render(dica('Explicação A', '12'))
    const g = screen.getByRole('button', { name: /12/ })
    fireEvent.focus(g)
    const box = screen.getByRole('tooltip')
    expect(box.textContent).toBe('Explicação A')
    expect(g.getAttribute('aria-describedby')).toBe(box.id)
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('toque abre; toque em outra dica fecha a primeira', () => {
    render(<>{dica('A', '1')}{dica('B', '2')}</>)
    fireEvent.pointerDown(screen.getByRole('button', { name: /1/ }), { pointerType: 'touch' })
    expect(screen.getByRole('tooltip').textContent).toBe('A')
    fireEvent.pointerDown(screen.getByRole('button', { name: /2/ }), { pointerType: 'touch' })
    expect(screen.getAllByRole('tooltip').map(t => t.textContent)).toEqual(['B'])
  })
  it('toque fora fecha', () => {
    render(<div><p>fora</p>{dica('A', '1')}</div>)
    fireEvent.pointerDown(screen.getByRole('button', { name: /1/ }), { pointerType: 'touch' })
    fireEvent.pointerDown(screen.getByText('fora'), { pointerType: 'touch' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('nunca title nativo', () => {
    const { container } = render(dica('A', '1'))
    expect(container.querySelector('[title]')).toBeNull()
  })
  // Mutantes que sobreviviam (Yannis M1): hover e foco são separados
  it('mouseEnter abre e mouseLeave fecha', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.mouseEnter(g)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(g)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('aberta por foco, continua aberta depois de mouseLeave', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.focus(g); fireEvent.mouseEnter(g); fireEvent.mouseLeave(g)
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
  it('com um popover aberto, sem role="tooltip" e sem aria-describedby (useTipShown)', () => {
    // Props do Popover conferidas contra `_chrome/flut/flut.test.tsx` (open, anchor, onClose, label); se o teste dele montar de outro jeito, copiar o jeito dele.
    render(<><button id="ancora-popover" type="button">menu</button><Popover open anchor={() => document.getElementById('ancora-popover')} onClose={() => {}} label="Menu de teste">conteúdo</Popover>{dica('A', '1')}</>)
    const g = screen.getByRole('button', { name: /^1$/ })
    fireEvent.focus(g)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(g.getAttribute('aria-describedby')).toBeNull()
  })
  // Naksu A6 + Re-revisão C2: o 2º toque na MESMA dica fecha, mesmo com mouseenter e foco emulados pelo navegador.
  it('toque abre; toque na mesma dica fecha (com mouseenter e foco emulados no meio)', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.pointerDown(g, { pointerType: 'touch' }); fireEvent.mouseEnter(g); fireEvent.focus(g)
    expect(screen.getByRole('tooltip').textContent).toBe('A')
    fireEvent.pointerDown(g, { pointerType: 'touch' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('aberta por foco e hover, um toque a fecha (sem esperar toque fora)', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.focus(g); fireEvent.mouseEnter(g)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.pointerDown(g, { pointerType: 'touch' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('depois de um toque e de sair da célula, Tab de volta abre pelo foco (o ignorar-foco é só do toque)', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    fireEvent.pointerDown(g, { pointerType: 'touch' })
    fireEvent.pointerDown(document.body, { pointerType: 'touch' }) // toque fora fecha
    fireEvent.blur(g)
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(g) // teclado: Tab de volta
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
  // Naksu A7: o gatilho é role="button"; Enter e Espaço têm de fazer algo.
  it('Enter e Espaço alternam; Espaço não rola a página; aria-expanded acompanha', () => {
    render(dica('A', '1'))
    const g = screen.getByRole('button', { name: /1/ })
    expect(g.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(screen.getByRole('tooltip')).toBeTruthy()
    expect(g.getAttribute('aria-expanded')).toBe('true')
    const naoCancelado = fireEvent.keyDown(g, { key: ' ' }) // fireEvent devolve false quando preventDefault foi chamado
    expect(naoCancelado).toBe(false)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(g.getAttribute('aria-expanded')).toBe('false')
  })
  // Naksu A8/A9: o que o CSS precisa garantir (o jsdom não faz layout; a medida real é o e2e do caso 6).
  it('CSS: alvo de 44 px só em td/cartão no toque, anel dentro da célula, sublinhado pontilhado, sem color-mix', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_canais/celula-dica.css'), 'utf8')
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[^{]*\{[^}]*(td|\.cards)[^{}]*\.cdica[^{}]*\{[^}]*min-height:\s*44px/)
    expect(css).toMatch(/(td|\.cards)[^{}]*\.cdica:focus-visible[^{}]*\{[^}]*outline-offset:\s*-2px/)
    expect(css).toMatch(/\.cdica[^{}]*\{[^}]*text-decoration:\s*underline dotted/)
    expect(css).not.toMatch(/color-mix/)
  })
  it('clique no gatilho não é engolido (sem stopPropagation): um ouvinte no document ainda o vê', () => {
    let visto = false
    const h = () => { visto = true }
    document.addEventListener('click', h)
    render(dica('A', '1'))
    fireEvent.click(screen.getByRole('button', { name: /1/ }))
    document.removeEventListener('click', h)
    expect(visto).toBe(true)
  })
})

describe('CelulaDica: teclado (Yannis I1/M2, Gio F2a)', () => {
  it('Enter abre A; Tab para B: A fecha (só uma dica aberta)', () => {
    render(<div>{dica('texto A', 'a')}{dica('texto B', 'b')}</div>)
    const [a, b] = screen.getAllByRole('button')
    a!.focus(); fireEvent.focus(a!)
    fireEvent.keyDown(a!, { key: 'Enter' }); fireEvent.keyDown(a!, { key: 'Enter' })
    expect(a!.getAttribute('aria-expanded')).toBe('true')
    fireEvent.blur(a!); b!.focus(); fireEvent.focus(b!)
    expect(a!.getAttribute('aria-expanded')).toBe('false')
  })
  it('Enter reabre A; Tab para um link comum: A fecha, o Esc não fica órfão', () => {
    render(<div>{dica('texto A', 'a')}<a href="#x">link</a></div>)
    const a = screen.getByRole('button')
    a.focus(); fireEvent.focus(a)
    fireEvent.keyDown(a, { key: 'Enter' }); fireEvent.keyDown(a, { key: 'Enter' })
    expect(a.getAttribute('aria-expanded')).toBe('true')
    fireEvent.blur(a); screen.getByRole('link').focus()
    expect(a.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
  it('roving: uma parada de Tab por linha; as setas andam entre as dicas da linha', () => {
    render(<div data-id="r1">{dica('A', 'a')}{dica('B', 'b')}{dica('C', 'c')}</div>)
    const [a, b, c] = screen.getAllByRole('button')
    expect([a, b, c].map(x => x!.tabIndex)).toEqual([0, -1, -1])
    a!.focus(); fireEvent.focus(a!)
    fireEvent.keyDown(a!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(b)
    fireEvent.focus(b!)
    expect([a, b, c].map(x => x!.tabIndex)).toEqual([-1, 0, -1])
    fireEvent.keyDown(b!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(a)
    fireEvent.keyDown(a!, { key: 'ArrowLeft' }) // na ponta: fica
    expect(document.activeElement).toBe(a)
  })
  it('roving: linhas distintas têm cada uma a sua parada', () => {
    render(<><div data-id="r1">{dica('A', 'a')}{dica('B', 'b')}</div><div data-id="r2">{dica('C', 'c')}{dica('D', 'd')}</div></>)
    expect(screen.getAllByRole('button').map(x => x.tabIndex)).toEqual([0, -1, 0, -1])
  })
})
