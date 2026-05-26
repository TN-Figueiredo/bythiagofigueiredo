// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Calendar: (props: Record<string, unknown>) => <svg data-testid="icon-calendar" {...props} />,
}))

vi.mock('@/lib/pipeline/colors', () => ({
  FORMAT_COLORS: {
    video: { accent: '#ef4444', bg: '#450a0a', text: '#fca5a5', border: '#7f1d1d' },
    blog_post: { accent: '#f59e0b', bg: '#451a03', text: '#fcd34d', border: '#78350f' },
    newsletter: { accent: '#6366f1', bg: '#1e1b4b', text: '#a5b4fc', border: '#312e81' },
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
    expect(screen.getByText('Esta Semana')).toBeTruthy()
  })

  it('renders 7 day columns', () => {
    const slots = [
      makeSlot({ day: '2026-05-25' }),
      makeSlot({ day: '2026-05-26' }),
      makeSlot({ day: '2026-05-27' }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/Seg/)).toBeTruthy()
    expect(screen.getByText(/Ter/)).toBeTruthy()
    expect(screen.getByText(/Qua/)).toBeTruthy()
  })

  it('shows filled slot with title as link', () => {
    const slots = [
      makeSlot({
        day: '2026-05-26',
        assignedItem: { id: 'item-1', title: 'Meu Video Legal', stage: 'gravacao' },
      }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText('Meu Video Legal')).toBeTruthy()
    const link = screen.getByText('Meu Video Legal').closest('a')
    expect(link?.getAttribute('href')).toBe('/cms/pipeline/items/item-1')
  })

  it('shows "slot vazio" for unfilled slots', () => {
    const slots = [makeSlot({ assignedItem: null })]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText('slot vazio')).toBeTruthy()
  })

  it('shows slot count summary', () => {
    const slots = [
      makeSlot({ day: '2026-05-26', assignedItem: { id: '1', title: 'A', stage: 'roteiro' } }),
      makeSlot({ day: '2026-05-26', assignedItem: { id: '2', title: 'B', stage: 'roteiro' } }),
      makeSlot({ day: '2026-05-27', assignedItem: null }),
      makeSlot({ day: '2026-05-28', assignedItem: null }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots })} />)
    expect(screen.getByText(/2\/4 slots preenchidos/)).toBeTruthy()
  })

  it('shows stage counts legend', () => {
    render(<UpNextThisWeek {...makeProps()} />)
    expect(screen.getByText(/3 escrever/)).toBeTruthy()
    expect(screen.getByText(/1 gravar/)).toBeTruthy()
  })

  it('shows streak when >= 2', () => {
    render(<UpNextThisWeek {...makeProps({ streak: { currentStreak: 5, isActive: true } })} />)
    expect(screen.getByText(/Streak: 5 semanas/)).toBeTruthy()
  })

  it('does not show streak when < 2', () => {
    render(<UpNextThisWeek {...makeProps({ streak: { currentStreak: 1, isActive: true } })} />)
    expect(screen.queryByText(/Streak/)).toBeNull()
  })

  it('past days have reduced opacity', () => {
    const slots = [
      makeSlot({ day: '2026-05-25' }),
      makeSlot({ day: '2026-05-27' }),
    ]
    render(<UpNextThisWeek {...makeProps({ slots, todayDate: '2026-05-26' })} />)
    const section = screen.getByRole('region')
    const dayColumns = section.querySelectorAll('[style*="opacity"]')
    const hasReducedOpacity = Array.from(dayColumns).some(
      el => el.getAttribute('style')?.includes('opacity: 0.4')
    )
    expect(hasReducedOpacity).toBe(true)
  })
})
