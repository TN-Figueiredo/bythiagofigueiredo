import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RecordingSheet } from '@/app/cms/(authed)/video/[id]/edit/_overlays/recording-sheet'
import type { RecordingSheetProps } from '@/app/cms/(authed)/video/[id]/edit/_overlays/recording-sheet'

const props = (): RecordingSheetProps => ({
  code: 'VID-007', channelName: 'Thiago Figueiredo', channelLabel: 'PT', channelFlag: '🇧🇷',
  pillarLabel: 'Viagem', durationRange: '6–7 min', recordingLocation: 'Lagoa Santa',
  title: 'Acordei às 6h',
  beats: [
    { idx: 0, name: 'KIT', status: 'PENDING', script: [{ type: 'line', text: 'Mic + power bank' }] },
    { idx: 1, name: 'HOOK', status: 'PENDING', script: [{ type: 'line', text: 'Acordei às 6h.', key: true }] },
    { idx: 2, name: 'ENTRADAS + PERGUNTAS', status: 'PENDING', script: [{ type: 'action', text: 'Aborde um finisher' }] },
    { idx: 3, name: 'B-ROLL SHOT LIST', status: 'PENDING', script: [{ type: 'line', text: 'orla vazia' }] },
  ],
  langOptions: [], onSwitchLang: vi.fn(), onClose: vi.fn(),
})

describe('RecordingSheet — performer lanes (actor sheet)', () => {
  afterEach(() => { cleanup(); document.body.classList.remove('recording') })

  it('renders only performer beats; prep + editor are not beats on the sheet', () => {
    render(<RecordingSheet {...props()} />)
    const names = Array.from(document.querySelectorAll('.rs-beat-name')).map((n) => n.textContent)
    expect(names).toEqual(['HOOK', 'ENTRADAS + PERGUNTAS']) // KIT (prep) + B-ROLL (editor) excluded
  })

  it('renumbers performer beats #1..#N (prep/editor pulled out)', () => {
    render(<RecordingSheet {...props()} />)
    const nums = Array.from(document.querySelectorAll('.rs-beat-num')).map((n) => n.textContent)
    expect(nums).toEqual(['#1', '#2'])
  })

  it('keeps shoot-day prep as a compact top checklist (not in the line flow)', () => {
    render(<RecordingSheet {...props()} />)
    const prep = document.querySelector('.rs-prep')
    expect(prep).not.toBeNull()
    expect(prep!.textContent).toContain('KIT')
    expect(prep!.textContent).toContain('Mic + power bank')
  })

  it('renders action items as action lines (do-list), distinct from spoken lines', () => {
    render(<RecordingSheet {...props()} />)
    const act = document.querySelector('.rs-line-act')
    expect(act).not.toBeNull()
    expect(act!.textContent).toContain('Aborde um finisher')
  })

  it('does not print the b-roll coverage line anywhere in the script body', () => {
    render(<RecordingSheet {...props()} />)
    const beats = document.querySelector('.rec-sheet')!
    // "orla vazia" is editor coverage — excluded from the actor's sheet
    const lineTexts = Array.from(beats.querySelectorAll('.rs-line-tx')).map((n) => n.textContent)
    expect(lineTexts.some((t) => t?.includes('orla vazia'))).toBe(false)
  })
})
