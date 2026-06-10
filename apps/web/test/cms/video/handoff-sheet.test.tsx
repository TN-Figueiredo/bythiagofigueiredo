import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HandoffSheet } from '@/app/cms/(authed)/video/[id]/edit/_overlays/handoff-sheet'
import type { HandoffSheetProps } from '@/app/cms/(authed)/video/[id]/edit/_overlays/handoff-sheet'

const baseProps = (): HandoffSheetProps => ({
  code: 'VID-001',
  channelLabel: 'PT',
  channelName: 'Thiago Figueiredo',
  activeLang: 'pt',
  versionsLabel: 'PT + EN',
  title: 'Como eu programo',
  deliverables: { editor: 'João', deadline: '30 abr', turnaround: '48h', drive: 'Drive/VID-001', energy: 'Ritmo acelerado, cortes secos', references: ['MKBHD', 'Fireship'] },
  style: [{ k: 'Cor', v: 'Quente' }, { k: 'Música', v: 'Lo-fi' }],
  ctas: {
    note: 'QR muda por idioma',
    rows: [{ k: 'Inscreva-se', pt: 'youtube.com/pt', en: 'youtube.com/en' }],
    display: 'Exibir QR nos últimos 10s',
  },
  beats: [
    {
      idx: 0,
      name: 'Abertura',
      status: 'PENDING',
      duration: 90,
      script: [
        { type: 'line', text: 'Linha âncora', key: true },
        { type: 'vis', text: 'B-roll cidade' },
      ],
    },
  ],
  langOptions: [],
  onSwitchLang: vi.fn(),
  onClose: vi.fn(),
})

describe('HandoffSheet', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    cleanup()
    document.body.classList.remove('recording')
  })

  it('uses body.recording (shared paper system) and cleans up on unmount', () => {
    const { unmount } = render(<HandoffSheet {...baseProps()} />)
    expect(document.body.classList.contains('recording')).toBe(true)
    unmount()
    expect(document.body.classList.contains('recording')).toBe(false)
  })

  it('renders beat number 1-indexed as #1 (NOT #0 — prototype off-by-one fix)', () => {
    render(<HandoffSheet {...baseProps()} />)
    expect(screen.getByText('#1')).toBeDefined()
    expect(screen.queryByText('#0')).toBeNull()
  })

  it('renders the derived anchor and b-roll cue from the script', () => {
    render(<HandoffSheet {...baseProps()} />)
    expect(screen.getByText(/Linha âncora/)).toBeDefined()
    expect(screen.getByText('B-roll cidade')).toBeDefined()
  })

  it('shows the per-language CTA/QR warning', () => {
    render(<HandoffSheet {...baseProps()} />)
    expect(document.querySelector('.hs-warn')?.textContent).toMatch(/muda por idioma/)
  })

  it('renders the editor CTA note above the table', () => {
    render(<HandoffSheet {...baseProps()} />)
    expect(screen.getByText('QR muda por idioma')).toBeDefined()
  })

  it('highlights the active-language CTA column', () => {
    render(<HandoffSheet {...baseProps()} />)
    expect(document.querySelector('tr.hl-pt')).not.toBeNull()
  })

  it('Escape closes via onClose', () => {
    const props = baseProps()
    render(<HandoffSheet {...props} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  // The editor is a foreigner: the handoff CHROME localizes by the handoff's OWN language
  // (activeLang here), independent of the global editor toggle. EN is the production default.
  describe('chrome localization by the handoff own language', () => {
    it('activeLang="en" renders English chrome', () => {
      render(<HandoffSheet {...baseProps()} activeLang="en" />)
      expect(screen.getByText(/Editing instructions/)).toBeDefined()
      expect(screen.getByText('Style & rhythm')).toBeDefined()
      expect(screen.getByText(/Key moments & b-roll/)).toBeDefined()
      expect(document.querySelector('.rb-title')?.textContent).toContain('Editor brief')
      // and NONE of the PT chrome leaks through
      expect(screen.queryByText(/Instruções de edição/)).toBeNull()
      expect(screen.queryByText('Estilo & ritmo')).toBeNull()
    })

    it('activeLang="pt" renders Portuguese chrome', () => {
      render(<HandoffSheet {...baseProps()} activeLang="pt" />)
      expect(screen.getByText(/Instruções de edição/)).toBeDefined()
      expect(screen.getByText('Estilo & ritmo')).toBeDefined()
      expect(screen.getByText(/Momentos-chave & b-roll/)).toBeDefined()
      expect(document.querySelector('.rb-title')?.textContent).toContain('Brief pro editor')
      expect(screen.queryByText(/Editing instructions/)).toBeNull()
    })

    it('any non-"en" lang falls back to Portuguese chrome', () => {
      render(<HandoffSheet {...baseProps()} activeLang="es" />)
      expect(screen.getByText(/Instruções de edição/)).toBeDefined()
      expect(screen.queryByText(/Editing instructions/)).toBeNull()
    })
  })

  it('CTA table keeps BOTH 🇧🇷 PT and 🇺🇸 EN columns regardless of chrome lang (content is bilingual on purpose)', () => {
    // EN chrome still shows both language columns…
    const { unmount } = render(<HandoffSheet {...baseProps()} activeLang="en" />)
    const headsEn = Array.from(document.querySelectorAll('.hs-table thead th')).map((th) => th.textContent)
    expect(headsEn).toContain('🇧🇷 PT')
    expect(headsEn).toContain('🇺🇸 EN')
    expect(screen.getByText('youtube.com/pt')).toBeDefined()
    expect(screen.getByText('youtube.com/en')).toBeDefined()
    unmount()

    // …and so does PT chrome.
    render(<HandoffSheet {...baseProps()} activeLang="pt" />)
    const headsPt = Array.from(document.querySelectorAll('.hs-table thead th')).map((th) => th.textContent)
    expect(headsPt).toContain('🇧🇷 PT')
    expect(headsPt).toContain('🇺🇸 EN')
  })
})
