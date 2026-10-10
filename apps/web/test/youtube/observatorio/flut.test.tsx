// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/flut.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useRef, useState } from 'react'
import { Popover, HoverTip } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/flut'
import { currentFlut } from '@/app/cms/(authed)/youtube/competitors/_chrome/flut/store'

afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })
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
})
