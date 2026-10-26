// @vitest-environment jsdom
// F2 do Remover canal, T6: o toast com ações não sai sozinho; clicar na ação chama e fecha.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ToastProvider, useToast, type ToastOpts } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

function Disparo({ opts }: { opts?: ToastOpts }) {
  const toast = useToast()
  return <button type="button" id="go" onClick={() => toast('ok', 'Título', 'Texto', opts)}>go</button>
}
const montar = (opts?: ToastOpts) => {
  const r = render(<div data-obs=""><ToastProvider><Disparo opts={opts} /></ToastProvider></div>)
  fireEvent.click(r.container.querySelector('#go')!)
  return r
}
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('toast com ações', () => {
  it('TA.1 com ação, não sai depois de 6,5 s (nem de 10 s)', () => {
    vi.useFakeTimers()
    const r = montar({ acoes: [{ rotulo: 'Desfazer', onClick: () => {} }] })
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(r.container.querySelector('.obs-ch-toast')).not.toBeNull()
  })
  it('T12/Q4 `fixo` (aviso âmbar de "algo restou"): não sai em 6,5 s nem em 60 s; sai no ✕', () => {
    vi.useFakeTimers()
    const r = montar({ fixo: true })
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(r.container.querySelector('.obs-ch-toast')).not.toBeNull()
    fireEvent.click(r.container.querySelector('.obs-ch-toast-x')!)
    expect(r.container.querySelector('.obs-ch-toast')).toBeNull()
  })
  it('TA.2 sem ação e sem texto selecionável, sai em 6,5 s (regressão)', () => {
    vi.useFakeTimers()
    const r = montar()
    expect(r.container.querySelector('.obs-ch-toast')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(6_600) })
    expect(r.container.querySelector('.obs-ch-toast')).toBeNull()
  })
  it('TA.3 clicar na ação chama onClick uma vez e remove o toast', () => {
    const onClick = vi.fn()
    const r = montar({ acoes: [{ rotulo: 'Desfazer', onClick }] })
    const b = [...r.container.querySelectorAll('.obs-ch-toast-acoes button')].find(x => x.textContent === 'Desfazer')!
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(r.container.querySelector('.obs-ch-toast')).toBeNull()
  })
  it('TA.4 abaixo de 600 px, o botão da ação tem 44 px (lido do CSS)', () => {
    const css = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/chrome.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width:600px\)\{\[data-obs\] \.obs-ch-toast-acoes \.obs-ch-btn\{min-height:44px\}\}/)
  })
})
