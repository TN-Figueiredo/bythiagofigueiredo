// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { useRef, useState, useEffect, type ReactElement } from 'react'
import { useModalFocusTrap } from '@/app/cms/(authed)/_shared/editor/use-modal-focus-trap'

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = '' })

/** Diálogo num portal que só monta depois de `quadros` quadros; o alerta (dentro dele) recebe foco ao montar. */
function Cena({ comAlerta }: { comAlerta: boolean }): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  useModalFocusTrap(ref, true, () => undefined)
  useEffect(() => { setMontado(true) }, [])
  if (!montado) return <div />
  return createPortal(
    <div ref={ref} role="dialog">
      <button id="primeiro">primeiro</button>
      {comAlerta ? <p id="alerta" role="alert" tabIndex={-1} ref={el => { el?.focus() }}>erro</p> : null}
    </div>,
    document.body,
  )
}

describe('useModalFocusTrap (M7b D15)', () => {
  it('o alerta que já tem o foco o mantém quando o nó do diálogo monta depois de N quadros', { repeats: 20 }, async () => {
    // rAF controlado: o diálogo só é "encontrado" pelo hook depois de 3 quadros
    const fila: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { fila.push(cb); return fila.length })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    render(<Cena comAlerta />)
    expect(document.getElementById('alerta')).toBe(document.activeElement)
    for (let i = 0; i < 4 && fila.length > 0; i++) await act(async () => { fila.shift()!(0) })
    expect(document.activeElement?.id).toBe('alerta')
  })

  it('sem nada focado dentro, o 1º focável recebe o foco depois do atraso (a regra antiga continua)', async () => {
    const fila: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { fila.push(cb); return fila.length })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    render(<Cena comAlerta={false} />)
    for (let i = 0; i < 4 && fila.length > 0; i++) await act(async () => { fila.shift()!(0) })
    expect(document.activeElement?.id).toBe('primeiro')
  })
})
