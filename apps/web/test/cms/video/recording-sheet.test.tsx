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
        { type: 'dir', text: 'Olhe direto pra câmera' },
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
    // beat.tone + inline dir both render a "Direção"-labelled .rs-tone note
    expect(screen.getAllByText('Direção').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Calmo, próximo')).toBeDefined()
  })

  it('shows line+pause always; prints dir as talent direction; hides vis/ed until showEd', () => {
    render(<RecordingSheet {...baseProps()} />)
    expect(document.querySelectorAll('.rs-line').length).toBe(1)
    expect(document.querySelector('.rs-pause')).not.toBeNull()
    expect(screen.queryByText('B-roll da cidade')).toBeNull()
    expect(screen.queryByText('Corte seco')).toBeNull()
    // dir is talent-facing → prints even with showEd off (inline "Direção" note)
    expect(screen.getByText('Olhe direto pra câmera')).toBeDefined()
  })

  it('reveals vis/ed when "Notas do editor" is on, dir direction note stays', () => {
    render(<RecordingSheet {...baseProps()} />)
    fireEvent.click(screen.getByText('Notas do editor'))
    expect(screen.getByText('B-roll da cidade')).toBeDefined()
    expect(screen.getByText('Corte seco')).toBeDefined()
    expect(screen.getByText('Olhe direto pra câmera')).toBeDefined()
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

describe('RecordingSheet — marking granularity (default OFF, the core ask)', () => {
  afterEach(() => { cleanup(); document.body.classList.remove('recording') })

  // A beat with two sections (line/pause/line  →  action boundary  →  line) so we can
  // count beat / section / line boxes precisely.
  const markProps = (markGran?: 'off' | 'beat' | 'secao' | 'linha', onSet = vi.fn()): RecordingSheetProps => ({
    code: 'VID-002', channelName: 'TF', channelLabel: 'PT', channelFlag: '🇧🇷',
    pillarLabel: 'Código', durationRange: '10 min', title: 'T',
    beats: [
      {
        idx: 0, name: 'HOOK', status: 'PENDING',
        script: [
          { type: 'line', text: 'um' },
          { type: 'pause', duration: 0.5 },   // stays inside section 1
          { type: 'line', text: 'dois' },
          { type: 'dir', text: 'olhe pra câmera' }, // flushes section 1
          { type: 'line', text: 'três' },     // section 2
        ],
      },
    ],
    langOptions: [], onSwitchLang: vi.fn(), onSetMarkGran: onSet, markGran, onClose: vi.fn(),
  })

  it('DEFAULTS to off: overlay carries mark-off and renders ZERO tick boxes (clean script)', () => {
    render(<RecordingSheet {...markProps(undefined)} />)
    const overlay = document.querySelector('.rec-overlay') as HTMLElement
    expect(overlay.classList.contains('mark-off')).toBe(true)
    expect(document.querySelectorAll('.rs-tick').length).toBe(0)
    expect(document.querySelectorAll('.rs-sectick').length).toBe(0)
    expect(document.querySelectorAll('.rs-beattick').length).toBe(0)
  })

  it('renders the "Marcação" segmented control with Off · Beat · Seção · Linha', () => {
    render(<RecordingSheet {...markProps('off')} />)
    const seg = document.querySelector('.rec-seg[title^="Marcação"]') as HTMLElement
    expect(seg).not.toBeNull()
    expect(Array.from(seg.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Off', 'Beat', 'Seção', 'Linha'])
    expect(seg.querySelector('button.on')!.textContent).toBe('Off')
  })

  it('clicking a Marcação option calls onSetMarkGran with that granularity', () => {
    const onSet = vi.fn()
    render(<RecordingSheet {...markProps('off', onSet)} />)
    const seg = document.querySelector('.rec-seg[title^="Marcação"]') as HTMLElement
    fireEvent.click(Array.from(seg.querySelectorAll('button')).find((b) => b.textContent === 'Beat')!)
    expect(onSet).toHaveBeenCalledWith('beat')
  })

  it('Beat → exactly ONE beat-box on the header, no per-line/section boxes', () => {
    render(<RecordingSheet {...markProps('beat')} />)
    expect(document.querySelector('.rec-overlay')!.classList.contains('mark-beat')).toBe(true)
    expect(document.querySelectorAll('.rs-beattick').length).toBe(1)
    expect(document.querySelectorAll('.rs-sectick').length).toBe(0)
    expect(document.querySelectorAll('.rs-line .rs-tick:not(.rs-sectick)').length).toBe(0)
  })

  it('Seção → one section-box per derived section (pause does not split; dir does)', () => {
    render(<RecordingSheet {...markProps('secao')} />)
    expect(document.querySelector('.rec-overlay')!.classList.contains('mark-secao')).toBe(true)
    // sections: [um, dois] (pause kept inside) | [três] (dir flushed) → 2 boxes
    expect(document.querySelectorAll('.rs-sectick').length).toBe(2)
    expect(document.querySelectorAll('.rs-beattick').length).toBe(0)
  })

  it('Linha → the legacy per-line box on every spoken line (opt-in)', () => {
    render(<RecordingSheet {...markProps('linha')} />)
    expect(document.querySelector('.rec-overlay')!.classList.contains('mark-linha')).toBe(true)
    // 3 line items → 3 per-line ticks; no sparse beat/section boxes
    expect(document.querySelectorAll('.rs-tick:not(.rs-sectick)').length).toBe(3)
    expect(document.querySelectorAll('.rs-sectick').length).toBe(0)
    expect(document.querySelectorAll('.rs-beattick').length).toBe(0)
  })
})

describe('RecordingSheet — full-screen READER (view: reader)', () => {
  afterEach(() => { cleanup(); document.body.classList.remove('recording') })

  // One fala beat with TWO derived sections: [um, dois] (pause stays in) | [três] (dir flushes).
  const readerProps = (onStatus = vi.fn()): RecordingSheetProps => ({
    code: 'VID-003', channelName: 'TF', channelLabel: 'PT', channelFlag: '🇧🇷',
    pillarLabel: 'Código', durationRange: '10 min', title: 'T',
    beats: [
      {
        id: 'beat-abc', idx: 0, name: 'HOOK', status: 'PENDING',
        script: [
          { type: 'line', text: 'um' },
          { type: 'pause', duration: 0.5 },
          { type: 'line', text: 'dois' },
          { type: 'dir', text: 'olhe pra câmera' },
          { type: 'line', text: 'três' },
        ],
      },
    ],
    langOptions: [{ lang: 'pt', label: 'PT', flag: '🇧🇷' }, { lang: 'en', label: 'EN', flag: '🇺🇸' }],
    onSwitchLang: vi.fn(), onSetBeatStatus: onStatus, onClose: vi.fn(),
  })

  const enterReader = () => fireEvent.click(screen.getByText('Leitura'))

  it('renders the Folha | Leitura view toggle, defaulting to Folha (print parity)', () => {
    render(<RecordingSheet {...readerProps()} />)
    const seg = document.querySelector('.rec-seg[title="Modo de visualização"]') as HTMLElement
    expect(seg).not.toBeNull()
    const btns = Array.from(seg.querySelectorAll('button')).map((b) => b.textContent)
    expect(btns).toEqual(['Folha', 'Leitura'])
    expect(seg.querySelector('button.on')!.textContent).toBe('Folha')
    // default view is the sheet, NOT the reader
    expect(document.querySelector('.recr')).toBeNull()
    expect(document.querySelector('.rec-sheet')).not.toBeNull()
  })

  it('switching to Leitura mounts the reader, sets view-reader, hides the sheet', () => {
    render(<RecordingSheet {...readerProps()} />)
    enterReader()
    expect(document.querySelector('.rec-overlay')!.classList.contains('view-reader')).toBe(true)
    expect(document.querySelector('.recr')).not.toBeNull()
    expect(document.querySelector('.rec-sheet')).toBeNull()
  })

  it('reader shows ONE section at a time — first card is section [um, dois]', () => {
    render(<RecordingSheet {...readerProps()} />)
    enterReader()
    const cards = document.querySelectorAll('.recr-card')
    expect(cards.length).toBe(1)
    const lines = document.querySelectorAll('.recr-tx')
    expect(Array.from(lines).map((l) => l.textContent)).toEqual(['um', 'dois'])
    expect(screen.getByText('Seção 1/2')).toBeDefined()
  })

  it('Next advances to the second section; prev is disabled at the start, next at the end', () => {
    render(<RecordingSheet {...readerProps()} />)
    enterReader()
    const prev = screen.getByLabelText('Seção anterior') as HTMLButtonElement
    const next = screen.getByLabelText('Próxima seção') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(Array.from(document.querySelectorAll('.recr-tx')).map((l) => l.textContent)).toEqual(['três'])
    expect(screen.getByText('Seção 2/2')).toBeDefined()
    expect((screen.getByLabelText('Próxima seção') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Seção anterior') as HTMLButtonElement).disabled).toBe(false)
  })

  it('"✓ Gravada" calls onSetBeatStatus with the beat key + auto-advances + opens undo', () => {
    const onStatus = vi.fn()
    render(<RecordingSheet {...readerProps(onStatus)} />)
    enterReader()
    fireEvent.click(screen.getByLabelText('Marcar seção como gravada e avançar'))
    expect(onStatus).toHaveBeenCalledWith('pt:beat-abc', 'gravada')
    // auto-advanced to section 2
    expect(screen.getByText('Seção 2/2')).toBeDefined()
    // undo toast appears
    expect(document.querySelector('.recr-toast')).not.toBeNull()
  })

  it('"⟲ Refazer" calls onSetBeatStatus with refazer and tints the card, no advance', () => {
    const onStatus = vi.fn()
    render(<RecordingSheet {...readerProps(onStatus)} />)
    enterReader()
    fireEvent.click(screen.getByLabelText('Marcar seção para refazer'))
    expect(onStatus).toHaveBeenCalledWith('pt:beat-abc', 'refazer')
    expect(document.querySelector('.recr-card')!.classList.contains('st-refazer')).toBe(true)
    expect(screen.getByText('Seção 1/2')).toBeDefined()
  })

  it('Desfazer reverts the status and the section index', () => {
    const onStatus = vi.fn()
    render(<RecordingSheet {...readerProps(onStatus)} />)
    enterReader()
    fireEvent.click(screen.getByLabelText('Marcar seção como gravada e avançar'))
    expect(screen.getByText('Seção 2/2')).toBeDefined()
    fireEvent.click(screen.getByText('Desfazer'))
    expect(onStatus).toHaveBeenLastCalledWith('pt:beat-abc', 'pendente')
    expect(screen.getByText('Seção 1/2')).toBeDefined()
    expect(document.querySelector('.recr-toast')).toBeNull()
  })

  it('keyboard: → advances, ← goes back, g marks gravada, r marks refazer', () => {
    const onStatus = vi.fn()
    render(<RecordingSheet {...readerProps(onStatus)} />)
    enterReader()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Seção 2/2')).toBeDefined()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Seção 1/2')).toBeDefined()
    fireEvent.keyDown(window, { key: 'r' })
    expect(onStatus).toHaveBeenCalledWith('pt:beat-abc', 'refazer')
    fireEvent.keyDown(window, { key: 'g' })
    expect(onStatus).toHaveBeenCalledWith('pt:beat-abc', 'gravada')
  })

  it('Imprimir flips back to the sheet view (print always uses the sheet)', () => {
    const printSpy = vi.fn()
    const orig = window.print
    window.print = printSpy
    try {
      render(<RecordingSheet {...readerProps()} />)
      enterReader()
      expect(document.querySelector('.recr')).not.toBeNull()
      fireEvent.click(screen.getByText('Imprimir'))
      expect(printSpy).toHaveBeenCalledTimes(1)
      expect(document.querySelector('.recr')).toBeNull()
      expect(document.querySelector('.rec-sheet')).not.toBeNull()
    } finally {
      window.print = orig
    }
  })

  it('works without onSetBeatStatus (optional prop) — set-status is a safe no-op + still advances', () => {
    const props = readerProps()
    delete props.onSetBeatStatus
    render(<RecordingSheet {...props} />)
    enterReader()
    fireEvent.click(screen.getByLabelText('Marcar seção como gravada e avançar'))
    expect(screen.getByText('Seção 2/2')).toBeDefined()
  })
})
