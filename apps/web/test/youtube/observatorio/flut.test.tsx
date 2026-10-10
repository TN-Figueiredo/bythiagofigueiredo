// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/flut.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useEffect, useRef, useState } from 'react'
import { Popover, HoverTip, useTipShown } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/flut'
import { currentFlut } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/store'

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.getElementById('flut')?.remove() })
const flut = () => document.getElementById('flut')

function Um({ id, onClose }: { id: string; onClose?: () => void }) {
  const [open, setOpen] = useState(false), btn = useRef<HTMLButtonElement>(null)
  return (
    <div style={{ overflow: 'hidden' }}>
      <button ref={btn} data-testid={'btn-' + id} aria-expanded={open} onClick={() => setOpen(o => !o)}>abrir {id}</button>
      <Popover open={open} anchor={() => btn.current} onClose={() => { setOpen(false); onClose?.() }} id={'pop-' + id} role="dialog" label={'Popover ' + id}>
        <button data-testid={'dentro-' + id}>dentro {id}</button>
      </Popover>
    </div>
  )
}

describe('flut · Popover', () => {
  it('fechado não renderiza; aberto mora em #flut, filho do body, com data-obs', () => {
    const { getByTestId } = render(<Um id="a" />)
    expect(flut()?.querySelector('#pop-a') ?? null).toBeNull()
    fireEvent.click(getByTestId('btn-a'))
    const pop = document.getElementById('pop-a')!
    expect(pop.parentElement).toBe(flut())
    expect(flut()!.parentElement).toBe(document.body)
    expect(flut()!.hasAttribute('data-obs')).toBe(true)
    expect(pop.getAttribute('role')).toBe('dialog')
    expect(pop.getAttribute('aria-label')).toBe('Popover a')
    expect(pop.style.position).toBe('fixed')
    expect(currentFlut()).toBe('pop-a')
  })
  it('uma aberta por vez: abrir a segunda fecha a primeira', () => {
    const { getByTestId } = render(<><Um id="a" /><Um id="b" /></>)
    fireEvent.click(getByTestId('btn-a'))
    fireEvent.click(getByTestId('btn-b'))
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.getElementById('pop-b')).not.toBeNull()
    expect(flut()!.children).toHaveLength(1)
  })
  it('Esc fecha e devolve o foco ao gatilho', () => {
    const { getByTestId } = render(<Um id="a" />)
    fireEvent.click(getByTestId('btn-a'))
    getByTestId('dentro-a').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.activeElement).toBe(getByTestId('btn-a'))
  })
  it('clique fora fecha e não mexe no foco; clique dentro e no gatilho não fecham por fora', () => {
    const { getByTestId } = render(<><Um id="a" /><button data-testid="fora">fora</button></>)
    fireEvent.click(getByTestId('btn-a'))
    fireEvent.mouseDown(getByTestId('dentro-a'))
    expect(document.getElementById('pop-a')).not.toBeNull()
    fireEvent.mouseDown(getByTestId('btn-a'))
    expect(document.getElementById('pop-a')).not.toBeNull()
    const focar = vi.spyOn(HTMLElement.prototype, 'focus')
    fireEvent.mouseDown(getByTestId('fora'))
    expect(document.getElementById('pop-a')).toBeNull()
    expect(focar).not.toHaveBeenCalled() // fechar por fora não devolve o foco ao gatilho (só o Esc devolve)
  })
  it('foco que vai para fora fecha', () => {
    const { getByTestId } = render(<><Um id="a" /><button data-testid="fora">fora</button></>)
    fireEvent.click(getByTestId('btn-a'))
    act(() => { getByTestId('fora').focus() })
    expect(document.getElementById('pop-a')).toBeNull()
  })
  it('gatilho que some do documento com a flutuante aberta: ela fecha', () => {
    const onClose = vi.fn()
    function Some() {
      const [tem, setTem] = useState(true), el = useRef<HTMLButtonElement | null>(null)
      return <>
        {tem ? <button ref={el} data-testid="g">g</button> : null}
        <button data-testid="tira" onClick={() => setTem(false)}>tira</button>
        <Popover open anchor={() => el.current} onClose={onClose} id="pop-s">x</Popover>
      </>
    }
    const { getByTestId } = render(<Some />)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(getByTestId('tira'))
    expect(onClose).toHaveBeenCalled()
  })
  it('ao abrir, o foco vai ao gatilho se não estiver nele nem dentro (Safari/Firefox no macOS não focam botão no clique)', () => {
    const { getByTestId } = render(<Um id="a" />)
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(getByTestId('btn-a'))
    expect(document.activeElement).toBe(getByTestId('btn-a'))
  })
  it('ao abrir, não rouba o foco de quem já o pôs dentro da caixa (menu que foca o primeiro item)', () => {
    function Menu() {
      const [open, setOpen] = useState(false), btn = useRef<HTMLButtonElement>(null), item = useRef<HTMLButtonElement>(null)
      return <>
        <button ref={btn} data-testid="g" onClick={() => setOpen(true)}>g</button>
        <Popover open={open} anchor={() => btn.current} onClose={() => setOpen(false)} id="pop-m" role="menu"><MenuItem r={item} /></Popover>
      </>
    }
    // the child focuses itself on mount, as the menus do: it runs before the layer's own effect
    function MenuItem({ r }: { r: React.RefObject<HTMLButtonElement | null> }) {
      useEffect(() => { r.current?.focus() }, [r])
      return <button ref={r} data-testid="item" role="menuitem" tabIndex={-1}>item</button>
    }
    const { getByTestId } = render(<Menu />)
    fireEvent.click(getByTestId('g'))
    expect(document.activeElement).toBe(getByTestId('item'))
  })
  it('o foco no gatilho ao abrir não rola a página (preventScroll)', () => {
    const focar = vi.spyOn(HTMLElement.prototype, 'focus')
    const { getByTestId } = render(<Um id="a" />)
    fireEvent.click(getByTestId('btn-a'))
    expect(focar).toHaveBeenCalledWith({ preventScroll: true })
  })
  it('a caixa aceita foco (tabIndex -1) para o anel de foco de teclado', () => {
    const { getByTestId } = render(<Um id="a" />)
    fireEvent.click(getByTestId('btn-a'))
    expect(document.getElementById('pop-a')!.getAttribute('tabindex')).toBe('-1')
  })
  it('no servidor não renderiza nada e não lança', () => {
    expect(() => renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).not.toThrow()
    expect(renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).toBe('')
  })
})

function Varios({ role = 'dialog', itens = 3, tabIndex }: { role?: 'dialog' | 'menu'; itens?: number; tabIndex?: number }) {
  const [open, setOpen] = useState(false), btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button data-testid="antes">antes</button>
      <button ref={btn} data-testid="g" aria-expanded={open} onClick={() => setOpen(o => !o)}>gatilho</button>
      <button data-testid="depois">depois</button>
      <Popover open={open} anchor={() => btn.current} onClose={() => setOpen(false)} id="pop-v" role={role} label="Varios">
        {Array.from({ length: itens }, (_, i) => <button key={i} data-testid={'i' + i} tabIndex={tabIndex} role={role === 'menu' ? 'menuitem' : undefined}>item {i}</button>)}
      </Popover>
    </>
  )
}
const abre = (r: ReturnType<typeof render>) => { fireEvent.click(r.getByTestId('g')); act(() => { r.getByTestId('g').focus() }) }

describe('flut · Tab entra e sai do popover pela ordem do gatilho (o popover mora no fim do body)', () => {
  it('1. Tab no gatilho com o popover aberto: o foco vai ao primeiro focável de dentro (preventDefault) e ele continua aberto', () => {
    const r = render(<Varios />)
    abre(r)
    const livre = fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab' })
    expect(livre).toBe(false)
    expect(document.activeElement).toBe(r.getByTestId('i0'))
    expect(document.getElementById('pop-v')).not.toBeNull()
  })
  it('1c. Ctrl/Alt/Meta+Tab não é da camada', () => {
    const r = render(<Varios />)
    abre(r)
    for (const k of ['ctrlKey', 'altKey', 'metaKey']) {
      expect(fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab', [k]: true })).toBe(true)
      expect(document.activeElement).toBe(r.getByTestId('g'))
    }
    act(() => { r.getByTestId('i2').focus() })
    const focar = vi.spyOn(HTMLElement.prototype, 'focus')
    expect(fireEvent.keyDown(r.getByTestId('i2'), { key: 'Tab', ctrlKey: true })).toBe(true)
    expect(focar).not.toHaveBeenCalled() // Ctrl+Tab no último não manda o foco ao gatilho
  })
  it('1d. o primeiro focável que não aceita o foco não engole o Tab', () => {
    const r = render(<Varios />)
    abre(r)
    vi.spyOn(r.getByTestId('i0'), 'focus').mockImplementation(() => {}) // as an element the DOM rules see as focusable but the browser will not focus
    expect(fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab' })).toBe(true) // not cancelled: the Tab goes on
    expect(document.activeElement).toBe(r.getByTestId('g'))
  })
  it('1b. Shift+Tab no gatilho não é da camada', () => {
    const r = render(<Varios />)
    abre(r)
    expect(fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab', shiftKey: true })).toBe(true)
    expect(document.activeElement).toBe(r.getByTestId('g'))
  })
  it('2. Tab no último focável: o foco vai ao gatilho SEM preventDefault; o foco que sai de vez fecha', () => {
    const r = render(<Varios />)
    abre(r)
    act(() => { r.getByTestId('i2').focus() })
    const livre = fireEvent.keyDown(r.getByTestId('i2'), { key: 'Tab' })
    expect(livre).toBe(true) // not cancelled: the browser finishes the Tab from the trigger
    expect(document.activeElement).toBe(r.getByTestId('g'))
    expect(document.getElementById('pop-v')).not.toBeNull() // the trigger is inside the layer's notion of "inside"
    act(() => { r.getByTestId('depois').focus() }) // what the browser does next
    expect(document.getElementById('pop-v')).toBeNull()
  })
  it('2b. Tab num focável do meio segue normal', () => {
    const r = render(<Varios />)
    abre(r)
    act(() => { r.getByTestId('i1').focus() })
    expect(fireEvent.keyDown(r.getByTestId('i1'), { key: 'Tab' })).toBe(true)
    expect(document.activeElement).toBe(r.getByTestId('i1'))
  })
  it('3. Shift+Tab no primeiro focável: o foco volta ao gatilho (preventDefault) e o popover continua aberto', () => {
    const r = render(<Varios />)
    abre(r)
    act(() => { r.getByTestId('i0').focus() })
    expect(fireEvent.keyDown(r.getByTestId('i0'), { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(r.getByTestId('g'))
    expect(document.getElementById('pop-v')).not.toBeNull()
  })
  it('4. nenhum focável dentro: Tab no gatilho segue normal', () => {
    const r = render(<Varios itens={0} />)
    abre(r)
    expect(fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab' })).toBe(true)
    expect(document.activeElement).toBe(r.getByTestId('g'))
    expect(document.getElementById('pop-v')).not.toBeNull()
  })
  it('focável escondido (hidden) não conta como primeiro', () => {
    function Esc() {
      const [open, setOpen] = useState(true), btn = useRef<HTMLButtonElement>(null)
      return <><button ref={btn} data-testid="g" onClick={() => setOpen(o => !o)}>g</button>
        <Popover open={open} anchor={() => btn.current} onClose={() => setOpen(false)} id="pop-e">
          <div hidden><button data-testid="oculto">oculto</button></div><button data-testid="visivel">visível</button>
        </Popover></>
    }
    const r = render(<Esc />)
    act(() => { r.getByTestId('g').focus() })
    fireEvent.keyDown(r.getByTestId('g'), { key: 'Tab' })
    expect(document.activeElement).toBe(r.getByTestId('visivel'))
  })
  it('menu (itens com tabIndex -1): qualquer item é primeiro e último; Tab sai pelo gatilho, Shift+Tab volta ao gatilho', () => {
    const r = render(<Varios role="menu" tabIndex={-1} />)
    abre(r)
    act(() => { r.getByTestId('i1').focus() })
    expect(fireEvent.keyDown(r.getByTestId('i1'), { key: 'Tab' })).toBe(true)
    expect(document.activeElement).toBe(r.getByTestId('g'))
    act(() => { r.getByTestId('i1').focus() })
    expect(fireEvent.keyDown(r.getByTestId('i1'), { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(r.getByTestId('g'))
    expect(document.getElementById('pop-v')).not.toBeNull() // menu button pattern: Shift+Tab leaves it open
    act(() => { r.getByTestId('depois').focus() })
    expect(document.getElementById('pop-v')).toBeNull()
  })
})

/** jsdom has no layout: gives each element with data-g / data-box a rect at x = its number (width 40, inside the window). */
function mockRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const x = Number(this.dataset.x ?? 0)
    return { left: x, right: x + (x ? 40 : 0), top: x ? 100 : 0, bottom: x ? 120 : 0, width: x ? 40 : 0, height: x ? 20 : 0, x, y: 0, toJSON: () => ({}) }
  })
}

describe('flut · Popover único compartilhado por vários gatilhos (lê o gatilho do render atual)', () => {
  function Compartilhado({ onClose }: { onClose: () => void }) {
    const [id, setId] = useState<string | null>(null)
    return <>
      <button data-g="a" data-x="100" data-testid="g-a" onClick={() => setId('a')}>a</button>
      <button data-g="b" data-x="300" data-testid="g-b" onClick={() => setId('b')}>b</button>
      <Popover open={id != null} anchor={() => document.querySelector('[data-g="' + id + '"]')} align="inicio"
        onClose={() => { setId(null); onClose() }} id="pop-c">x</Popover>
    </>
  }
  it('abre no primeiro clique: não chama onClose e continua aberto junto do gatilho', () => {
    mockRects()
    const onClose = vi.fn()
    const { getByTestId } = render(<Compartilhado onClose={onClose} />)
    fireEvent.click(getByTestId('g-a'))
    expect(onClose).not.toHaveBeenCalled()
    const pop = document.getElementById('pop-c')!
    expect(pop).not.toBeNull()
    expect(pop.style.left).toBe('100px')
  })
  it('trocar o estado de um gatilho para outro mantém aberto apontando para o novo', () => {
    mockRects()
    const onClose = vi.fn()
    const { getByTestId } = render(<Compartilhado onClose={onClose} />)
    fireEvent.click(getByTestId('g-a'))
    fireEvent.click(getByTestId('g-b'))
    expect(onClose).not.toHaveBeenCalled()
    expect(document.getElementById('pop-c')!.style.left).toBe('300px')
  })
  it('o onClose chamado pelo posicionamento é o do render atual', () => {
    const vistos: string[] = []
    function Comeca() {
      const [n, setN] = useState(0), [alvo, setAlvo] = useState(false)
      return <>
        <button data-testid="muda" onClick={() => { setN(1); setAlvo(true) }}>muda</button>
        {/* the anchor exists only when `alvo`; before that it is gone, and gone() must call THIS render's onClose */}
        <Popover open anchor={() => (alvo ? null : document.body)} onClose={() => { vistos.push('n' + n) }} id="pop-oc">x</Popover>
      </>
    }
    const { getByTestId } = render(<Comeca />)
    expect(vistos).toEqual([])
    fireEvent.click(getByTestId('muda'))
    expect(vistos).toEqual(['n1'])
  })
})

describe('flut · HoverTip', () => {
  function Dica({ show }: { show: boolean }) {
    const el = useRef<HTMLSpanElement>(null)
    return <><span ref={el}>?</span><HoverTip show={show} anchor={() => el.current} id="tip-1" className="minha">texto da dica</HoverTip></>
  }
  it('aparece em #flut como tooltip, com a classe que não captura clique', () => {
    render(<Dica show />)
    const tip = document.getElementById('tip-1')!
    expect(tip.parentElement).toBe(flut())
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.classList.contains('obs-fl-tip')).toBe(true)
    expect(tip.classList.contains('minha')).toBe(true)
    expect(tip.textContent).toBe('texto da dica')
  })
  it('show falso não renderiza', () => {
    render(<Dica show={false} />)
    expect(document.getElementById('tip-1')).toBeNull()
  })
  it('se esconde enquanto há um popover aberto', () => {
    const { getByTestId } = render(<><Dica show /><Um id="a" /></>)
    expect(document.getElementById('tip-1')).not.toBeNull()
    fireEvent.click(getByTestId('btn-a'))
    expect(document.getElementById('tip-1')).toBeNull()
  })
  it('as opções do render atual valem na hora: cx que muda reposiciona sem esperar outro render', () => {
    mockRects()
    function Segue({ cx }: { cx: number }) {
      return <><span data-x="100" id="alvo">?</span><HoverTip show anchor={() => document.getElementById('alvo')} cx={cx} id="tip-cx">t</HoverTip></>
    }
    const { rerender } = render(<Segue cx={200} />)
    expect(document.getElementById('tip-cx')!.style.left).toBe('200px')
    rerender(<Segue cx={400} />)
    expect(document.getElementById('tip-cx')!.style.left).toBe('400px')
  })
  const visivel = () => [...(flut()?.children ?? [])].filter(c => (c as HTMLElement).style.visibility !== 'hidden')
  it('show verdadeiro com anchor nulo não deixa nada visível em #flut (nem em 0,0)', () => {
    render(<><HoverTip show anchor={() => null} id="tip-n">t</HoverTip></>)
    expect(visivel()).toHaveLength(0)
  })
  it('gatilho que some do documento com a dica aberta: a dica some; se voltar, a dica volta', () => {
    mockRects()
    function Some() {
      const [tem, setTem] = useState(true)
      return <>
        {tem ? <span data-x="100" id="alvo-s">?</span> : null}
        <button data-testid="alterna" onClick={() => setTem(t => !t)}>alterna</button>
        <HoverTip show anchor={() => document.getElementById('alvo-s')} id="tip-s">t</HoverTip>
      </>
    }
    const { getByTestId } = render(<Some />)
    expect(visivel().map(c => c.id)).toEqual(['tip-s'])
    fireEvent.click(getByTestId('alterna'))
    expect(visivel()).toHaveLength(0)
    fireEvent.click(getByTestId('alterna'))
    expect(visivel().map(c => c.id)).toEqual(['tip-s'])
  })
  it('show alternando depois de ter ficado "gone": a dica volta a aparecer', () => {
    mockRects()
    function Alterna({ show, tem }: { show: boolean; tem: boolean }) {
      return <>{tem ? <span data-x="100" id="alvo-a">?</span> : null}<HoverTip show={show} anchor={() => document.getElementById('alvo-a')} id="tip-a">t</HoverTip></>
    }
    const { rerender } = render(<Alterna show tem={false} />)
    expect(visivel()).toHaveLength(0)
    rerender(<Alterna show={false} tem />)
    expect(document.getElementById('tip-a')).toBeNull()
    rerender(<Alterna show tem />)
    expect(visivel().map(c => c.id)).toEqual(['tip-a'])
  })
})

/** Rects by element id, changeable between assertions (a scroll or resize moves the trigger). */
const rects: Record<string, { left: number; top: number; w: number; h: number }> = {}
function mockRectsById() {
  for (const k of Object.keys(rects)) delete rects[k]
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const r = rects[this.id]
    if (!r) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
    return { left: r.left, right: r.left + r.w, top: r.top, bottom: r.top + r.h, width: r.w, height: r.h, x: r.left, y: r.top, toJSON: () => ({}) }
  })
}

describe('flut · posicionamento ao vivo', () => {
  function Alvo({ onClose = () => {} }: { onClose?: () => void }) {
    return <><button id="alvo-p">g</button><Popover open anchor={() => document.getElementById('alvo-p')} align="inicio" onClose={onClose} id="pop-p">x</Popover></>
  }
  it('rolagem reposiciona a caixa junto do gatilho; rolar a própria caixa não', () => {
    mockRectsById()
    rects['alvo-p'] = { left: 100, top: 100, w: 40, h: 20 }
    render(<Alvo />)
    const pop = document.getElementById('pop-p')!
    expect(pop.style.left).toBe('100px')
    rects['alvo-p'] = { left: 160, top: 100, w: 40, h: 20 }
    act(() => { pop.dispatchEvent(new Event('scroll')) })
    expect(pop.style.left).toBe('100px') // scroll inside the box: nothing moves
    act(() => { document.dispatchEvent(new Event('scroll')) })
    expect(pop.style.left).toBe('160px')
  })
  it('redimensionar a janela reposiciona', () => {
    mockRectsById()
    rects['alvo-p'] = { left: 100, top: 100, w: 40, h: 20 }
    render(<Alvo />)
    rects['alvo-p'] = { left: 220, top: 100, w: 40, h: 20 }
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(document.getElementById('pop-p')!.style.left).toBe('220px')
  })
  it('gatilho que rola para fora da janela: o popover chama onClose e fica oculto', () => {
    mockRectsById()
    rects['alvo-p'] = { left: 100, top: 100, w: 40, h: 20 }
    const onClose = vi.fn()
    render(<Alvo onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
    rects['alvo-p'] = { left: 100, top: -500, w: 40, h: 20 }
    act(() => { document.dispatchEvent(new Event('scroll')) })
    expect(onClose).toHaveBeenCalled()
    expect(document.getElementById('pop-p')!.style.visibility).toBe('hidden')
  })
  it('a dica de um gatilho que rola para fora da janela fica oculta, e volta quando ele volta', () => {
    mockRectsById()
    rects['alvo-d'] = { left: 100, top: 100, w: 40, h: 20 }
    render(<><span id="alvo-d">?</span><HoverTip show anchor={() => document.getElementById('alvo-d')} id="tip-d">t</HoverTip></>)
    const tip = document.getElementById('tip-d')!
    expect(tip.style.visibility).toBe('')
    rects['alvo-d'] = { left: 100, top: 2000, w: 40, h: 20 }
    act(() => { document.dispatchEvent(new Event('scroll')) })
    expect(tip.style.visibility).toBe('hidden')
    rects['alvo-d'] = { left: 100, top: 100, w: 40, h: 20 }
    act(() => { document.dispatchEvent(new Event('scroll')) })
    expect(tip.style.visibility).toBe('')
  })
  it('gatilho que entra no documento SEM render nosso: a dica oculta aparece sozinha (MutationObserver)', async () => {
    mockRectsById()
    render(<HoverTip show anchor={() => document.getElementById('alvo-m')} id="tip-m">t</HoverTip>)
    const tip = document.getElementById('tip-m')!
    expect(tip.style.visibility).toBe('hidden')
    const el = document.createElement('span')
    el.id = 'alvo-m'
    rects['alvo-m'] = { left: 100, top: 100, w: 40, h: 20 }
    await act(async () => { document.body.appendChild(el); await Promise.resolve() })
    expect(tip.style.visibility).toBe('')
    el.remove()
  })
  it('posAnchor: a posição vem dele; o foco e o Esc continuam no gatilho', () => {
    mockRectsById()
    rects['g-pa'] = { left: 100, top: 100, w: 40, h: 20 }
    rects['bloco-pa'] = { left: 300, top: 100, w: 60, h: 20 }
    function Pa() {
      const [open, setOpen] = useState(false)
      return <>
        <span id="bloco-pa"><button id="g-pa" data-testid="g" onClick={() => setOpen(true)}>g</button></span>
        <Popover open={open} anchor={() => document.getElementById('g-pa')} posAnchor={() => document.getElementById('bloco-pa')} align="inicio" onClose={() => setOpen(false)} id="pop-pa">x</Popover>
      </>
    }
    const { getByTestId } = render(<Pa />)
    fireEvent.click(getByTestId('g'))
    expect(document.getElementById('pop-pa')!.style.left).toBe('300px')
    expect(document.activeElement).toBe(getByTestId('g'))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.getElementById('pop-pa')).toBeNull()
    expect(document.activeElement).toBe(getByTestId('g'))
  })
  it('posAnchor também vale para a dica', () => {
    mockRectsById()
    rects['g-pb'] = { left: 100, top: 100, w: 40, h: 20 }
    rects['bloco-pb'] = { left: 500, top: 100, w: 60, h: 20 }
    render(<><span id="bloco-pb" /><span id="g-pb" />
      <HoverTip show anchor={() => document.getElementById('g-pb')} posAnchor={() => document.getElementById('bloco-pb')} align="inicio" id="tip-pb">t</HoverTip></>)
    expect(document.getElementById('tip-pb')!.style.left).toBe('500px')
  })
  it('mede a caixa a partir do canto: left/top da última posição não entram na medida', () => {
    mockRectsById()
    rects['alvo-z'] = { left: 100, top: 100, w: 40, h: 20 }
    const vistos: string[] = []
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { if (this.id === 'tip-z') vistos.push(this.style.left + '/' + this.style.top); return 50 } })
    try {
      render(<><span id="alvo-z" /><HoverTip show anchor={() => document.getElementById('alvo-z')} align="inicio" id="tip-z">t</HoverTip></>)
      rects['alvo-z'] = { left: 200, top: 100, w: 40, h: 20 }
      act(() => { document.dispatchEvent(new Event('scroll')) })
      expect(document.getElementById('tip-z')!.style.left).toBe('200px')
      expect(vistos.length).toBeGreaterThanOrEqual(2)
      expect(new Set(vistos)).toEqual(new Set(['0px/0px']))
    } finally {
      if (desc) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', desc); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth
    }
  })
  it('observa a própria caixa (conteúdo que cresce reposiciona)', () => {
    mockRectsById()
    rects['alvo-r'] = { left: 100, top: 100, w: 40, h: 20 }
    const observados: Element[] = []
    class RO { constructor(public cb: () => void) {} observe(e: Element) { observados.push(e) } disconnect() {} unobserve() {} }
    vi.stubGlobal('ResizeObserver', RO)
    try {
      render(<><span id="alvo-r" /><Popover open anchor={() => document.getElementById('alvo-r')} onClose={() => {}} id="pop-r">x</Popover></>)
      expect(observados).toContain(document.getElementById('pop-r'))
      expect(observados).toContain(document.getElementById('alvo-r'))
    } finally { vi.unstubAllGlobals() }
  })
})

describe('flut · useTipShown', () => {
  function Gatilho({ show }: { show: boolean }) {
    const mostrada = useTipShown(show)
    return <span data-testid="alvo" aria-describedby={mostrada ? 'tip-u' : undefined}>?</span>
  }
  it('só descreve pela dica quando ela está de fato renderizada: show e nenhum popover aberto', () => {
    const { getByTestId, rerender } = render(<><Gatilho show={false} /><Um id="a" /></>)
    expect(getByTestId('alvo').getAttribute('aria-describedby')).toBeNull()
    rerender(<><Gatilho show /><Um id="a" /></>)
    expect(getByTestId('alvo').getAttribute('aria-describedby')).toBe('tip-u')
    fireEvent.click(getByTestId('btn-a'))
    expect(getByTestId('alvo').getAttribute('aria-describedby')).toBeNull()
    fireEvent.click(getByTestId('btn-a'))
    expect(getByTestId('alvo').getAttribute('aria-describedby')).toBe('tip-u')
  })
})
