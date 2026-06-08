import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RecordingSheet } from '@/app/cms/(authed)/video/[id]/edit/_overlays/recording-sheet'
import type { RecordingSheetProps } from '@/app/cms/(authed)/video/[id]/edit/_overlays/recording-sheet'

const baseProps = (): RecordingSheetProps => ({
  code: 'VID-001',
  channelName: 'Thiago Figueiredo',
  channelLabel: 'PT',
  channelFlag: '🇧🇷',
  pillarLabel: 'Código',
  durationRange: '14–17 min',
  recordingLocation: 'Estúdio',
  title: 'Como eu programo',
  beats: [
    {
      idx: 0,
      name: 'Abertura',
      status: 'PENDING',
      duration: 90,
      tone: 'Calmo, próximo',
      script: [
        { type: 'line', text: 'Olá **pessoal**', key: true },
        { type: 'pause', duration: 0.5 },
        { type: 'vis', text: 'B-roll da cidade' },
        { type: 'ed', text: 'Corte seco' },
        { type: 'dir', text: 'NÃO renderiza' },
      ],
    },
  ],
  langOptions: [],
  onSwitchLang: vi.fn(),
  onClose: vi.fn(),
})

describe('RecordingSheet', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    cleanup()
    document.body.classList.remove('recording')
  })

  it('adds body.recording while mounted and removes on unmount', () => {
    const { unmount } = render(<RecordingSheet {...baseProps()} />)
    expect(document.body.classList.contains('recording')).toBe(true)
    unmount()
    expect(document.body.classList.contains('recording')).toBe(false)
  })

  it('renders beat-level .rs-tone "Direção" from beat.tone, always visible', () => {
    render(<RecordingSheet {...baseProps()} />)
    expect(document.querySelector('.rs-tone')).not.toBeNull()
    expect(screen.getByText('Direção')).toBeDefined()
    expect(screen.getByText('Calmo, próximo')).toBeDefined()
  })

  it('shows line+pause always; hides vis/ed and never renders dir until showEd', () => {
    render(<RecordingSheet {...baseProps()} />)
    expect(document.querySelectorAll('.rs-line').length).toBe(1)
    expect(document.querySelector('.rs-pause')).not.toBeNull()
    expect(screen.queryByText('B-roll da cidade')).toBeNull()
    expect(screen.queryByText('Corte seco')).toBeNull()
    // dir never appears regardless of toggle
    expect(screen.queryByText('NÃO renderiza')).toBeNull()
  })

  it('reveals vis/ed when "Notas do editor" is on, still never dir', () => {
    render(<RecordingSheet {...baseProps()} />)
    fireEvent.click(screen.getByText('Notas do editor'))
    expect(screen.getByText('B-roll da cidade')).toBeDefined()
    expect(screen.getByText('Corte seco')).toBeDefined()
    expect(screen.queryByText('NÃO renderiza')).toBeNull()
  })

  it('A+ / A− step --rs-scale within clamp [0.85,1.4]', () => {
    render(<RecordingSheet {...baseProps()} />)
    const overlay = document.querySelector('.rec-overlay') as HTMLElement
    expect(overlay.style.getPropertyValue('--rs-scale')).toBe('1')
    fireEvent.click(screen.getByTitle('Maior'))
    expect(overlay.style.getPropertyValue('--rs-scale')).toBe('1.05')
    fireEvent.click(screen.getByTitle('Menor'))
    expect(overlay.style.getPropertyValue('--rs-scale')).toBe('1')
  })

  it('1-indexes beat numbers (#1) and shows the meta row', () => {
    render(<RecordingSheet {...baseProps()} />)
    expect(screen.getByText('#1')).toBeDefined()
    expect(screen.getByText('Beats')).toBeDefined()
  })

  it('Escape closes via onClose', () => {
    const props = baseProps()
    render(<RecordingSheet {...props} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('idea-only (no beats) shows the empty state and no .rec-sheet', () => {
    render(<RecordingSheet {...{ ...baseProps(), beats: [] }} />)
    expect(document.querySelector('.rec-empty')).not.toBeNull()
    expect(document.querySelector('.rec-sheet')).toBeNull()
  })

  it('density defaults to "conf": root carries dens-conf and "Confortável" is .on', () => {
    render(<RecordingSheet {...baseProps()} />)
    const overlay = document.querySelector('.rec-overlay') as HTMLElement
    expect(overlay.classList.contains('dens-conf')).toBe(true)
    expect(overlay.classList.contains('dens-comp')).toBe(false)

    const seg = document.querySelector('.rec-seg[title="Densidade da folha"]') as HTMLElement
    expect(seg).not.toBeNull()
    const buttons = seg.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].textContent).toBe('Compacto')
    expect(buttons[1].textContent).toBe('Confortável')
    expect(buttons[1].classList.contains('on')).toBe(true)
    expect(buttons[0].classList.contains('on')).toBe(false)
  })

  it('clicking "Compacto" applies dens-comp on the root and marks the button .on', () => {
    render(<RecordingSheet {...baseProps()} />)
    fireEvent.click(screen.getByText('Compacto'))
    const overlay = document.querySelector('.rec-overlay') as HTMLElement
    expect(overlay.classList.contains('dens-comp')).toBe(true)
    expect(overlay.classList.contains('dens-conf')).toBe(false)

    const seg = document.querySelector('.rec-seg[title="Densidade da folha"]') as HTMLElement
    const buttons = seg.querySelectorAll('button')
    expect(buttons[0].classList.contains('on')).toBe(true)
    expect(buttons[1].classList.contains('on')).toBe(false)
  })
})
