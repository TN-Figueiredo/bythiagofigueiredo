import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { CoworkButton } from '@/app/cms/(authed)/video/[id]/edit/_components/cowork-button'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const openCowork = vi.fn()
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

describe('CoworkButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    openCowork.mockClear()
    toastSuccess.mockClear()
  })
  afterEach(() => {
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
    expect(trigger.getAttribute('aria-controls')).toBe(pop.id)
    expect(document.querySelector('.cw-input')!.getAttribute('aria-label')).toBe('Mensagem para o Cowork')
    expect(document.querySelector('.cw-kbd')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the per-stage placeholder', () => {
    renderBtn()
    openPopover()
    expect(document.querySelector('.cw-input')!.getAttribute('placeholder'))
      .toContain('e se o gancho fosse mais incômodo')
  })

  it('send → opens Cowork, shows sending state + toast, then clears/closes and returns focus', () => {
    renderBtn()
    const trigger = openPopover()
    const ta = document.querySelector('.cw-input') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'encurta o hook' } })

    const sendBtn = document.querySelector('.cw-send') as HTMLButtonElement
    fireEvent.click(sendBtn)

    // deep-link opened with video context + the message
    expect(openCowork).toHaveBeenCalledTimes(1)
    const instruction = openCowork.mock.calls[0][0] as string
    expect(instruction).toContain('V-A07')
    expect(instruction).toContain('encurta o hook')

    // toast confirms
    expect(toastSuccess).toHaveBeenCalledWith('Aberto no Claude', { description: 'Cowork recebeu o contexto do vídeo.' })

    // button reflects the sending state
    expect(document.querySelector('.cw-send')!.textContent).toContain('mandando')

    // after the delay: popover closes + focus returns to trigger
    act(() => { vi.advanceTimersByTime(420) })
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
  })

  it('Escape closes the popover and returns focus to the trigger', () => {
    renderBtn()
    const trigger = openPopover()
    expect(document.querySelector('.cw-pop')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.cw-pop')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('a clicked quick-chip sends its prompt straight to Cowork', () => {
    renderBtn()
    openPopover()
    const chip = document.querySelector('.cw-chip') as HTMLButtonElement
    const chipText = chip.textContent
    fireEvent.click(chip)
    expect(openCowork).toHaveBeenCalledTimes(1)
    expect(openCowork.mock.calls[0][0] as string).toContain(chipText!)
  })
})
