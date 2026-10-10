// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/flut.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useRef, useState } from 'react'
import { Popover, HoverTip } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/flut'
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
    fireEvent.mouseDown(getByTestId('fora'))
    expect(document.getElementById('pop-a')).toBeNull()
    expect(document.activeElement).not.toBe(getByTestId('btn-a'))
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
  it('no servidor não renderiza nada e não lança', () => {
    expect(() => renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).not.toThrow()
    expect(renderToString(<Popover open anchor={() => null} onClose={() => {}}>x</Popover>)).toBe('')
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
