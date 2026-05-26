// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next/dynamic to resolve loaders synchronously in tests.
// The loader Promise is awaited inline; since Vitest mocks are already in the module registry,
// the resolved module is the mocked stub.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null

    // Kick off resolution immediately
    loader().then(mod => {
      ResolvedComponent = mod.default
    })

    // Return a component that forces a re-render after resolution via a state update.
    // Tests that click to open the picker must use `act(async () => ...)` or `waitFor`
    // if they need the lazy component. For this suite we wrap with a tiny Suspense shim.
    const Wrapper: React.FC<Record<string, unknown>> = (props) => {
      const [C, setC] = React.useState<React.ComponentType<Record<string, unknown>> | null>(
        () => ResolvedComponent
      )
      React.useLayoutEffect(() => {
        if (!C && ResolvedComponent) setC(() => ResolvedComponent)
      })
      return C ? React.createElement(C, props) : null
    }
    return Wrapper
  },
}))

// WeekSlotPicker stub — renders a dialog with candidate buttons so tests can assert interaction
vi.mock('../../src/app/cms/(authed)/pipeline/_components/week-slot-picker', () => ({
  WeekSlotPicker: ({
    candidates,
    onAssign,
    onClose,
  }: {
    candidates: Array<{ id: string; title: string }>
    onAssign: (id: string, day: string, hour: string | null) => Promise<void>
    onClose: () => void
    slot: unknown
    anchorRef: unknown
  }) => {
    React.useEffect(() => {
      const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])
    return (
      <div role="dialog" aria-label="Picker">
        {candidates.map(c => (
          <button key={c.id} type="button" onClick={() => onAssign(c.id, '2026-05-26', '10:00')}>
            {c.title}
          </button>
        ))}
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
    )
  },
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Calendar: (props: Record<string, unknown>) => <svg data-testid="icon-calendar" {...props} />,
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="icon-swap" {...props} />,
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: 'var(--gem-danger)', bg: 'color-mix(in srgb, var(--gem-danger) 8%, transparent)', text: 'var(--gem-danger)', border: 'color-mix(in srgb, var(--gem-danger) 25%, transparent)' },
    blog_post: { accent: 'var(--gem-warn)', bg: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)', text: 'var(--gem-warn)', border: 'color-mix(in srgb, var(--gem-warn) 25%, transparent)' },
    newsletter: { accent: 'var(--gem-accent)', bg: 'color-mix(in srgb, var(--gem-accent) 8%, transparent)', text: 'var(--gem-muted)', border: 'color-mix(in srgb, var(--gem-accent) 25%, transparent)' },
  },
}))

import { UpNextThisWeek, type WeekGridProps } from '../../src/app/cms/(authed)/pipeline/_components/up-next-this-week'
import type { WeekSlot } from '../../src/lib/pipeline/up-next-types'

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

function makeProps(overrides: Partial<WeekGridProps> = {}): WeekGridProps {
  return {
    slots: [makeSlot()],
    todayDate: '2026-05-26',
    stageCounts: { escrever: 3, gravar: 1, 'pos-prod': 2, prontos: 1 },
    totalEffortMinutes: 360,
    streak: { currentStreak: 3, isActive: true },
    nextWeekEmpty: 2,
    backlogCount: 5,
    ...overrides,
  }
}

describe('UpNextThisWeek', () => {
  it('returns null when slots is empty', () => {
    const { container } = render(<UpNextThisWeek {...makeProps({ slots: [] })} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders section header "Esta Semana"', () => {
    render(<UpNextThisWeek {...makeProps()} />)
    expect(screen.getByText('Esta Semana')).toBeDefined()
  })

  it('renders 7 day columns', () => {
    const slots = [
      makeSlot({ day: '2026-05-25' }),
      makeSlot({ day: '2026-05-26' }),
      makeSlot({ day: '2026-05-27' }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/Seg/)).toBeDefined()
    expect(screen.getByText(/Ter/)).toBeDefined()
    expect(screen.getByText(/Qua/)).toBeDefined()
  })

  it('shows filled slot with title as link', () => {
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video Legal', stage: 'gravacao' },
      }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText('Meu Video Legal')).toBeDefined()
    const link = screen.getByText('Meu Video Legal').closest('a')
    expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/item-1')
  })

  it('shows format label for unfilled slots', () => {
    const slots = [makeSlot({ assignedItem: null, format: 'video' })]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/\+ Video/)).toBeDefined()
  })

  it('shows "+ Blog" for blog_post empty slot', () => {
    const slots = [makeSlot({ assignedItem: null, format: 'blog_post' })]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/\+ Blog/)).toBeDefined()
  })

  it('shows "+ News" for newsletter empty slot', () => {
    const slots = [makeSlot({ assignedItem: null, format: 'newsletter' })]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/\+ News/)).toBeDefined()
  })

  it('shows slot count summary', () => {
    const slots = [
      makeSlot({ day: '2026-05-26', assignedItem: { id: '1', title: 'A', stage: 'roteiro' } }),
      makeSlot({ day: '2026-05-26', assignedItem: { id: '2', title: 'B', stage: 'roteiro' } }),
      makeSlot({ day: '2026-05-27', assignedItem: null }),
      makeSlot({ day: '2026-05-28', assignedItem: null }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/2\/4 slots preenchidos/)).toBeDefined()
  })

  it('shows stage counts legend', () => {
    render(<UpNextThisWeek {...makeProps()} />)
    expect(screen.getByText(/3 escrever/)).toBeDefined()
    expect(screen.getByText(/1 gravar/)).toBeDefined()
  })

  it('shows streak when >= 2', () => {
    render(<UpNextThisWeek {...makeProps({ streak: { currentStreak: 5, isActive: true } })} />)
    expect(screen.getByText(/Streak: 5 semanas/)).toBeDefined()
  })

  it('does not show streak when < 2', () => {
    render(<UpNextThisWeek {...makeProps({ streak: { currentStreak: 1, isActive: true } })} />)
    expect(screen.queryByText(/Streak/)).toBeNull()
  })

  it('shows backlog count', () => {
    render(<UpNextThisWeek {...makeProps({ backlogCount: 5 })} />)
    expect(screen.getByText(/5 no backlog/)).toBeDefined()
  })

  it('shows tudo pronto when all slots filled', () => {
    const slots = [
      makeSlot({ day: '2026-05-26', assignedItem: { id: '1', title: 'V1', stage: 'gravacao' } }),
      makeSlot({ day: '2026-05-27', assignedItem: { id: '2', title: 'V2', stage: 'roteiro' } }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/tudo pronto/)).toBeDefined()
  })

  it('past days use dimmed background instead of opacity', () => {
    const slots = [
      makeSlot({ day: '2026-05-25' }),
      makeSlot({ day: '2026-05-27' }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots, todayDate: '2026-05-26' })} />)
    const section = screen.getByRole('region')
    const listItems = section.querySelectorAll('[role="listitem"]')
    const pastDay = Array.from(listItems).find(el => {
      const style = el.getAttribute('style') ?? ''
      return !style.includes('opacity') && /rgba\(237,?\s*242,?\s*247,?\s*0\.03\)/.test(style)
    })
    expect(pastDay).toBeDefined()
  })

  it('clicking empty slot opens picker dialog', () => {
    const slots = [makeSlot({ day: '2026-05-26', assignedItem: null })]
    render(
      <UpNextThisWeek
        {...makeProps({ slots, candidates: [], onAssignSlot: vi.fn() })}
      />
    )
    const emptySlotBtn = screen.getByTestId('empty-slot-2026-05-26')
    fireEvent.click(emptySlotBtn)
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('pressing Escape closes picker dialog', () => {
    const slots = [makeSlot({ day: '2026-05-26', assignedItem: null })]
    render(
      <UpNextThisWeek
        {...makeProps({ slots, candidates: [], onAssignSlot: vi.fn() })}
      />
    )
    const emptySlotBtn = screen.getByTestId('empty-slot-2026-05-26')
    fireEvent.click(emptySlotBtn)
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows swap button on filled slots when onAssignSlot is provided', () => {
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video', stage: 'gravacao' },
      }),
    ]
    render(
      <UpNextThisWeek
        {...makeProps({ slots, candidates: [], onAssignSlot: vi.fn() })}
      />
    )
    expect(screen.getByLabelText('Trocar Meu Video')).toBeDefined()
  })

  it('does not show swap button when onAssignSlot is not provided', () => {
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video', stage: 'gravacao' },
      }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.queryByLabelText('Trocar Meu Video')).toBeNull()
  })

  it('clicking swap button opens picker dialog', () => {
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video', stage: 'gravacao' },
      }),
    ]
    render(
      <UpNextThisWeek
        {...makeProps({ slots, candidates: [], onAssignSlot: vi.fn() })}
      />
    )
    fireEvent.click(screen.getByLabelText('Trocar Meu Video'))
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('swap picker calls onAssignSlot with previousItemId', async () => {
    const onAssign = vi.fn().mockResolvedValue(undefined)
    const candidate = { id: 'new-1', title: 'Novo Video', stage: 'roteiro' as const, format: 'video' as const, language: 'pt-br' as const }
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video', stage: 'gravacao' },
      }),
    ]
    render(
      <UpNextThisWeek
        {...makeProps({ slots, candidates: [candidate], onAssignSlot: onAssign })}
      />
    )
    fireEvent.click(screen.getByLabelText('Trocar Meu Video'))
    const pickerItem = screen.getByText('Novo Video')
    fireEvent.click(pickerItem)
    await vi.waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('new-1', '2026-05-26', '10:00', 'item-1')
    })
  })

  it('uses role="list" for week list semantics', () => {
    render(<UpNextThisWeek {...makeProps()} />)
    const region = screen.getByRole('region')
    const list = region.querySelector('[role="list"]')
    expect(list).toBeDefined()
    expect(list).not.toBeNull()
  })

  describe('highlight mode', () => {
    const selectedItem = {
      id: 'x',
      title: 'X',
      stage: 'draft' as const,
      format: 'video' as const,
      language: 'pt-br' as const,
      playlist_id: null,
      playlist_name: null,
      playlist_position: null,
      playlist_total: null,
    }

    it('adds pulse highlight to compatible empty slots when selectedItem set', () => {
      const slots = [makeSlot({ day: '2026-05-26', assignedItem: null, format: 'video' })]
      render(
        <UpNextThisWeek
          {...makeProps({ slots, selectedItem, onAssignSlot: vi.fn() })}
        />
      )
      const emptyBtn = screen.getByTestId('empty-slot-2026-05-26')
      const classes = emptyBtn.className.split(/\s+/)
      expect(classes).toContain('motion-safe:animate-pulse')
      // happy-dom splits border shorthand when CSS vars present:
      // "border: 2px solid;" + "border-color: var(--gem-accent)"
      const style = emptyBtn.getAttribute('style') ?? ''
      expect(style).toContain('border: 2px solid')
      expect(style).toContain('color: var(--gem-accent)')
    })

    it('shows selected item title in compatible empty slot', () => {
      const slots = [makeSlot({ day: '2026-05-26', assignedItem: null, format: 'video' })]
      render(
        <UpNextThisWeek
          {...makeProps({ slots, selectedItem, onAssignSlot: vi.fn() })}
        />
      )
      const emptyBtn = screen.getByTestId('empty-slot-2026-05-26')
      expect(emptyBtn.textContent).toBe('X')
    })

    it('does NOT highlight slots with wrong format', () => {
      const slots = [makeSlot({ day: '2026-05-26', assignedItem: null, format: 'blog_post' })]
      render(
        <UpNextThisWeek
          {...makeProps({ slots, selectedItem, onAssignSlot: vi.fn() })}
        />
      )
      const emptyBtn = screen.getByTestId('empty-slot-2026-05-26')
      const classes = emptyBtn.className.split(/\s+/)
      expect(classes).not.toContain('motion-safe:animate-pulse')
      // Non-compatible slots keep dashed border, not solid accent border
      const style = emptyBtn.getAttribute('style') ?? ''
      expect(style).not.toContain('2px solid var(--gem-accent)')
    })

    it('clicking highlighted slot calls onAssignSlot with selectedItem id', () => {
      const onAssign = vi.fn().mockResolvedValue(undefined)
      const slots = [makeSlot({ day: '2026-05-26', assignedItem: null, format: 'video', hour: '10:00' })]
      render(
        <UpNextThisWeek
          {...makeProps({ slots, selectedItem, onAssignSlot: onAssign })}
        />
      )
      const emptyBtn = screen.getByTestId('empty-slot-2026-05-26')
      fireEvent.click(emptyBtn)
      expect(onAssign).toHaveBeenCalledWith('x', '2026-05-26', '10:00')
    })

    it('calls onItemAssigned after direct assignment', () => {
      const onAssign = vi.fn().mockResolvedValue(undefined)
      const onItemAssigned = vi.fn()
      const slots = [makeSlot({ day: '2026-05-26', assignedItem: null, format: 'video', hour: '10:00' })]
      render(
        <UpNextThisWeek
          {...makeProps({ slots, selectedItem, onAssignSlot: onAssign, onItemAssigned })}
        />
      )
      const emptyBtn = screen.getByTestId('empty-slot-2026-05-26')
      fireEvent.click(emptyBtn)
      expect(onItemAssigned).toHaveBeenCalled()
    })
  })
})
