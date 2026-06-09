import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { CoworkButton } from '@/app/cms/(authed)/video/[id]/edit/_components/cowork-button'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const openCowork = vi.fn(() => true)
const toastSuccess = vi.fn()

vi.mock('@/lib/pipeline/cowork-deeplink', () => ({
  openCowork: (...args: unknown[]) => openCowork(...args),
}))
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}))

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'ideia',
  editMode: 'edit', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

// rAF runs the post-send phase work synchronously under fake timers.
let rafSpy: ReturnType<typeof vi.spyOn>

function renderBtn() {
  return render(
    <VideoEditorProvider initialState={seed}>
      <CoworkButton stage="ideia" />
    </VideoEditorProvider>,
  )
}

function openPopover() {
  const trigger = document.querySelector('.cw-btn') as HTMLButtonElement
  fireEvent.click(trigger)
  return trigger
}

/** Drive the send through its phases: rAF (sending→sent+toast) then the 900ms close
 * timer (sent→closing) then the exit fallback (closing→unmount). */
function flushSend() {
  act(() => { vi.advanceTimersByTime(0) }) // rAF callback
  act(() => { vi.advanceTimersByTime(900) }) // sent → closing
  act(() => { vi.advanceTimersByTime(220) }) // closing → unmount (reduced-motion fallback)
}

describe('CoworkButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    openCowork.mockClear()
    toastSuccess.mockClear()
    // requestAnimationFrame → setTimeout(0) so fake timers can drive it deterministically.
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return window.setTimeout(() => cb(performance.now()), 0) as unknown as number
    })
  })
  afterEach(() => {
    rafSpy.mockRestore()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('exposes dialog a11y wiring on the trigger + popover', () => {
    renderBtn()
    const trigger = openPopover()
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const pop = document.querySelector('.cw-pop')!
    expect(pop.getAttribute('role')).toBe('dialog')
    expect(pop.getAttribute('aria-modal')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(pop.id)
    // labelledby/describedby point at the header + sub (no generic aria-label)
    expect(pop.getAttribute('aria-label')).toBeNull()
    const head = document.querySelector('.cw-head')!
    const sub = document.querySelector('.cw-sub')!
    expect(head.tagName).toBe('H2')
    expect(pop.getAttribute('aria-labelledby')).toBe(head.id)
    expect(pop.getAttribute('aria-describedby')).toBe(sub.id)
    expect(document.querySelector('.cw-input')!.getAttribute('aria-label')).toBe('Mensagem para o Cowork')
    expect(document.querySelector('.cw-kbd')!.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('.cw-kbd')!.textContent).toBe('⌘↵')
  })

  it('aria-controls does not dangle when closed', () => {
    renderBtn()
    const trigger = document.querySelector('.cw-btn') as HTMLButtonElement
    expect(trigger.getAttribute('aria-controls')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-controls')).not.toBeNull()
  })

  it('uses the per-stage placeholder', () => {
    renderBtn()
    openPopover()
    expect(document.querySelector('.cw-input')!.getAttribute('placeholder'))
      .toContain('e se o gancho fosse mais incômodo')
  })

  it('send → opens Cowork, shows phase labels + toast, then closes and returns focus', () => {
    renderBtn()
    const trigger = openPopover()
    const ta = document.querySelector('.cw-input') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'encurta o hook' } })

    const sendBtn = document.querySelector('.cw-send') as HTMLButtonElement
    fireEvent.click(sendBtn)

    // deep-link opened with video context + the message (synchronous)
    expect(openCowork).toHaveBeenCalledTimes(1)
    const instruction = openCowork.mock.calls[0][0] as string
    expect(instruction).toContain('V-A07')
    expect(instruction).toContain('encurta o hook')

    // immediately reflects the 'sending' phase
    expect(document.querySelector('.cw-send')!.textContent).toContain('mandando')

    // next frame: 'sent' label + durable toast receipt
    act(() => { vi.advanceTimersByTime(0) })
    expect(document.querySelector('.cw-send')!.textContent).toContain('enviado')
    expect(toastSuccess).toHaveBeenCalledWith('Claude aberto — instrução copiada', {
      description: 'cole no Cowork com ⌘V pra ele começar (já vem com o contexto do vídeo).',
    })

    // after the receipt window + exit: popover unmounts + focus returns to trigger
    act(() => { vi.advanceTimersByTime(900) })
    act(() => { vi.advanceTimersByTime(220) })
    expect(document.querySelector('.cw-pop')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('guards re-entry: a second click while sending does not open Cowork twice', () => {
    renderBtn()
    openPopover()
    const ta = document.querySelector('.cw-input') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'corta 15s' } })
    const sendBtn = document.querySelector('.cw-send') as HTMLButtonElement
    fireEvent.click(sendBtn)
    fireEvent.click(sendBtn)
    expect(openCowork).toHaveBeenCalledTimes(1)
    flushSend()
  })

  it('Escape closes the popover and returns focus to the trigger', () => {
    renderBtn()
    const trigger = openPopover()
    expect(document.querySelector('.cw-pop')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.cw-pop')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('traps Tab focus within the popover, wrapping last→first', () => {
    renderBtn()
    openPopover()
    const sendBtn = document.querySelector('.cw-send') as HTMLButtonElement
    // Give the (empty-disabled) send a value so it's a valid focus target, then focus it.
    const ta = document.querySelector('.cw-input') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'x' } })
    sendBtn.focus()
    expect(document.activeElement).toBe(sendBtn)
    // Tab from the last focusable wraps back to the first (a chip).
    fireEvent.keyDown(document, { key: 'Tab' })
    const firstChip = document.querySelector('.cw-chip') as HTMLButtonElement
    expect(document.activeElement).toBe(firstChip)
    // Shift+Tab from the first wraps to the last (send).
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(sendBtn)
  })

  it('a clicked quick-chip sends its prompt straight to Cowork', () => {
    renderBtn()
    openPopover()
    const chip = document.querySelector('.cw-chip') as HTMLButtonElement
    const chipText = chip.textContent
    fireEvent.click(chip)
    expect(openCowork).toHaveBeenCalledTimes(1)
    expect(openCowork.mock.calls[0][0] as string).toContain(chipText!)
    flushSend()
  })
})
