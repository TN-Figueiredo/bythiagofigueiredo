// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-danger)', bg: 'var(--gem-danger-bg)', text: 'var(--gem-danger)', border: 'var(--gem-danger-border)' },
    blog_post: { accent: 'var(--gem-warn)', bg: 'var(--gem-warn-bg)', text: 'var(--gem-warn)', border: 'var(--gem-warn-border)' },
  },
}))

vi.mock('@/lib/pipeline/up-next-constants', () => ({
  STAGE_ORDER: {
    idea: 0, outline: 1, draft: 2, roteiro: 3,
    gravacao: 4, edicao: 5, pos_producao: 6, ready: 7, scheduled: 8, published: 9,
  },
  LOCALE_TO_LANGUAGE: { pt: 'pt-br', en: 'en' },
}))

import { WeekSlotPicker } from '../../src/app/cms/(authed)/pipeline/_components/week-slot-picker'
import type { WeekSlot, SlotCandidate } from '../../src/lib/pipeline/up-next-types'

function makeSlot(overrides: Partial<WeekSlot> = {}): WeekSlot {
  return {
    day: '2026-05-26',
    dayLabel: 'Ter',
    hour: '10:00',
    format: 'video',
    channelLocale: 'pt',
    channelId: 'ch-1',
    isRestDay: false,
    assignedItem: null,
    effortMinutes: 180,
    ...overrides,
  }
}

function makeCandidate(overrides: Partial<SlotCandidate> = {}): SlotCandidate {
  return {
    id: 'c-1',
    title: 'Meu Video',
    stage: 'roteiro',
    format: 'video',
    language: 'pt-br',
    ...overrides,
  }
}

describe('WeekSlotPicker', () => {
  const onAssign = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset viewport to avoid leaks between tests
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true })
  })

  it('renders dialog with search input', () => {
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[makeCandidate()]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByLabelText('Buscar item para o slot')).toBeDefined()
  })

  it('shows candidates matching slot format', () => {
    const candidates = [
      makeCandidate({ id: '1', title: 'Video A', format: 'video', stage: 'roteiro' }),
      makeCandidate({ id: '2', title: 'Blog B', format: 'blog_post', stage: 'draft' }),
    ]
    render(
      <WeekSlotPicker
        slot={makeSlot({ format: 'video' })}
        candidates={candidates}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Video A')).toBeDefined()
    expect(screen.queryByText('Blog B')).toBeNull()
  })

  it('filters candidates by search query', () => {
    const candidates = [
      makeCandidate({ id: '1', title: 'Tutorial React', stage: 'roteiro' }),
      makeCandidate({ id: '2', title: 'Review Node', stage: 'roteiro' }),
    ]
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={candidates}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    const input = screen.getByLabelText('Buscar item para o slot')
    fireEvent.change(input, { target: { value: 'react' } })
    expect(screen.getByText('Tutorial React')).toBeDefined()
    expect(screen.queryByText('Review Node')).toBeNull()
  })

  it('shows "Nenhum item encontrado" when no candidates match', () => {
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Nenhum item encontrado')).toBeDefined()
  })

  it('excludes candidates at scheduled stage or later', () => {
    const candidates = [
      makeCandidate({ id: '1', title: 'Already Scheduled', stage: 'scheduled' }),
      makeCandidate({ id: '2', title: 'Still Editing', stage: 'edicao' }),
    ]
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={candidates}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    expect(screen.queryByText('Already Scheduled')).toBeNull()
    expect(screen.getByText('Still Editing')).toBeDefined()
  })

  it('calls onAssign with correct args when clicking a candidate', async () => {
    render(
      <WeekSlotPicker
        slot={makeSlot({ day: '2026-05-26', hour: '10:00' })}
        candidates={[makeCandidate({ id: 'c-1', title: 'Meu Video' })]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Meu Video'))
    await vi.waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('c-1', '2026-05-26', '10:00')
    })
  })

  it('calls onClose after successful assignment', async () => {
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[makeCandidate()]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Meu Video'))
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error message when onAssign rejects', async () => {
    const failingAssign = vi.fn().mockRejectedValue(new Error('Slot conflict'))
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[makeCandidate()]}
        onAssign={failingAssign}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Meu Video'))
    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText('Slot conflict')).toBeDefined()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[makeCandidate()]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on click outside', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <WeekSlotPicker
          slot={makeSlot()}
          candidates={[makeCandidate()]}
          onAssign={onAssign}
          onClose={onClose}
        />
      </div>
    )
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalled()
  })

  it('sorts candidates by stage descending (most progressed first)', () => {
    const candidates = [
      makeCandidate({ id: '1', title: 'Early Idea', stage: 'idea' }),
      makeCandidate({ id: '2', title: 'In Edit', stage: 'edicao' }),
      makeCandidate({ id: '3', title: 'Script Done', stage: 'roteiro' }),
    ]
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={candidates}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('In Edit') || b.textContent?.includes('Script Done') || b.textContent?.includes('Early Idea'))
    expect(buttons[0]?.textContent).toContain('In Edit')
    expect(buttons[1]?.textContent).toContain('Script Done')
    expect(buttons[2]?.textContent).toContain('Early Idea')
  })

  it('limits displayed candidates to 8', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      makeCandidate({ id: `c-${i}`, title: `Video ${i}`, stage: 'roteiro' })
    )
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={candidates}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    const items = screen.getAllByRole('button').filter(b => b.textContent?.startsWith('Video'))
    expect(items.length).toBe(8)
  })

  it('disables buttons during loading', async () => {
    const slowAssign = vi.fn().mockImplementation(() => new Promise(() => {}))
    render(
      <WeekSlotPicker
        slot={makeSlot()}
        candidates={[makeCandidate()]}
        onAssign={slowAssign}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText('Meu Video'))
    await vi.waitFor(() => {
      const btn = screen.getByText('Meu Video').closest('button')
      expect(btn?.disabled).toBe(true)
    })
  })

  it('has aria-describedby pointing to picker context', () => {
    render(
      <WeekSlotPicker
        slot={makeSlot({ format: 'video' })}
        candidates={[makeCandidate()]}
        onAssign={onAssign}
        onClose={onClose}
      />
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-describedby')).toBe('picker-context')
    const context = document.getElementById('picker-context')
    expect(context?.textContent).toContain('Video')
  })

  it('filters candidates by language compatibility with slot locale', () => {
    const ptSlot = makeSlot({ channelLocale: 'pt' })
    const candidates = [
      makeCandidate({ id: '1', title: 'PT Video', language: 'pt-br' }),
      makeCandidate({ id: '2', title: 'EN Video', language: 'en' }),
      makeCandidate({ id: '3', title: 'Both Video', language: 'both' }),
    ]

    render(
      <WeekSlotPicker slot={ptSlot} candidates={candidates} onAssign={onAssign} onClose={onClose} />
    )

    expect(screen.getByText('PT Video')).toBeDefined()
    expect(screen.queryByText('EN Video')).toBeNull()
    expect(screen.getByText('Both Video')).toBeDefined()
  })

  it('shows all candidates when slot has no channelLocale (blog/newsletter)', () => {
    const blogSlot = makeSlot({ format: 'blog_post', channelLocale: null, channelId: null })
    const candidates = [
      makeCandidate({ id: '1', title: 'PT Post', format: 'blog_post', language: 'pt-br' }),
      makeCandidate({ id: '2', title: 'EN Post', format: 'blog_post', language: 'en' }),
    ]

    render(
      <WeekSlotPicker slot={blogSlot} candidates={candidates} onAssign={onAssign} onClose={onClose} />
    )

    expect(screen.getByText('PT Post')).toBeDefined()
    expect(screen.getByText('EN Post')).toBeDefined()
  })

  it('renders with fixed positioning when anchorRef is provided', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    anchor.getBoundingClientRect = () => ({
      top: 100, left: 50, bottom: 130, right: 200,
      width: 150, height: 30, x: 50, y: 100, toJSON: () => ({}),
    })

    render(
      <WeekSlotPicker
        slot={makeSlot()} candidates={[makeCandidate()]}
        onAssign={onAssign} onClose={onClose}
        anchorRef={{ current: anchor }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('fixed')
    expect(dialog.style.top).toBe('134px')
    expect(dialog.style.left).toBe('50px')
    document.body.removeChild(anchor)
  })

  it('clamps picker left when anchor is near right viewport edge', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    Object.defineProperty(window, 'innerWidth', { value: 300, writable: true, configurable: true })
    anchor.getBoundingClientRect = () => ({
      top: 100, left: 200, bottom: 130, right: 350,
      width: 150, height: 30, x: 200, y: 100, toJSON: () => ({}),
    })

    render(
      <WeekSlotPicker
        slot={makeSlot()} candidates={[makeCandidate()]}
        onAssign={onAssign} onClose={onClose}
        anchorRef={{ current: anchor }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(parseInt(dialog.style.left)).toBeLessThanOrEqual(44)
    document.body.removeChild(anchor)
  })

  it('flips picker above anchor when near bottom viewport edge', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    Object.defineProperty(window, 'innerHeight', { value: 200, writable: true, configurable: true })
    anchor.getBoundingClientRect = () => ({
      top: 150, left: 50, bottom: 180, right: 200,
      width: 150, height: 30, x: 50, y: 150, toJSON: () => ({}),
    })

    render(
      <WeekSlotPicker
        slot={makeSlot()} candidates={[makeCandidate()]}
        onAssign={onAssign} onClose={onClose}
        anchorRef={{ current: anchor }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.style.top).toBe('8px')
    document.body.removeChild(anchor)
  })

  it('repositions on scroll event', async () => {
    // Reset viewport to large values to avoid clamping from previous tests
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })

    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    let anchorTop = 100
    anchor.getBoundingClientRect = () => ({
      top: anchorTop, left: 50, bottom: anchorTop + 30, right: 200,
      width: 150, height: 30, x: 50, y: anchorTop, toJSON: () => ({}),
    })

    // Mock rAF to execute callbacks synchronously
    const origRaf = window.requestAnimationFrame
    const origCaf = window.cancelAnimationFrame
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }
    window.cancelAnimationFrame = () => {}

    render(
      <WeekSlotPicker
        slot={makeSlot()} candidates={[makeCandidate()]}
        onAssign={onAssign} onClose={onClose}
        anchorRef={{ current: anchor }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.style.top).toBe('134px')

    anchorTop = 50
    fireEvent.scroll(window)

    await vi.waitFor(() => {
      expect(dialog.style.top).toBe('84px')
    })

    window.requestAnimationFrame = origRaf
    window.cancelAnimationFrame = origCaf
    document.body.removeChild(anchor)
  })
})
