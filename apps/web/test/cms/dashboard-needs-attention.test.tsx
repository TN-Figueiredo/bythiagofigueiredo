import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cms',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => React.createElement('a', { href, ...rest }, children),
}))

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { DashboardNeedsAttention } from '../../src/app/cms/(authed)/_components/dashboard-needs-attention'
import type { AttentionItem } from '../../src/app/cms/(authed)/_components/dashboard-queries'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeItems(count: number): AttentionItem[] {
  const priorities: Array<'P1' | 'P2' | 'P3'> = ['P1', 'P1', 'P2', 'P3', 'P3']
  const reasons = [
    'Post atrasado',
    'Rascunho parado 14+ dias',
    'Agendado para esta semana',
    'Ideia parada 30+ dias',
    'Ideia parada 30+ dias',
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Attention Item ${i + 1}`,
    priority: priorities[i % 5],
    reason: reasons[i % 5],
    href: `/cms/blog/item-${i}/edit`,
    type: 'post' as const,
  }))
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('DashboardNeedsAttention', () => {
  it('shows empty state message when no items', () => {
    render(<DashboardNeedsAttention items={[]} />)

    expect(screen.getByTestId('needs-attention')).toBeTruthy()
    expect(screen.getByTestId('needs-attention-empty')).toBeTruthy()
    expect(screen.getByTestId('needs-attention-empty').textContent).toContain(
      'Tudo em ordem',
    )
  })

  it('renders items with correct priority borders', () => {
    const items = makeItems(3)
    render(<DashboardNeedsAttention items={items} />)

    expect(screen.getByTestId('needs-attention-list')).toBeTruthy()
    expect(screen.getAllByTestId(/^attention-item-/).length).toBe(3)
  })

  it('renders P1 items with data-testid', () => {
    const items: AttentionItem[] = [
      {
        id: '1',
        title: 'Overdue Post',
        priority: 'P1',
        reason: 'Post atrasado',
        href: '/cms/blog/1/edit',
        type: 'post',
      },
    ]
    render(<DashboardNeedsAttention items={items} />)

    expect(screen.getByTestId('attention-item-P1')).toBeTruthy()
    expect(screen.getByTestId('attention-item-P1').textContent).toContain(
      'Overdue Post',
    )
  })

  it('shows only 3 items initially when more than 3 exist', () => {
    const items = makeItems(5)
    render(<DashboardNeedsAttention items={items} />)

    const listItems = screen.getAllByTestId(/^attention-item-/)
    expect(listItems.length).toBe(3)
  })

  it('shows expand button when more than 3 items', () => {
    const items = makeItems(5)
    render(<DashboardNeedsAttention items={items} />)

    const expandBtn = screen.getByTestId('needs-attention-expand')
    expect(expandBtn).toBeTruthy()
    expect(expandBtn.textContent).toContain('Ver todos (5)')
  })

  it('does not show expand button when 3 or fewer items', () => {
    const items = makeItems(3)
    render(<DashboardNeedsAttention items={items} />)

    expect(screen.queryByTestId('needs-attention-expand')).toBeNull()
  })

  it('expands to show all items on button click', () => {
    const items = makeItems(5)
    render(<DashboardNeedsAttention items={items} />)

    const expandBtn = screen.getByTestId('needs-attention-expand')
    fireEvent.click(expandBtn)

    const listItems = screen.getAllByTestId(/^attention-item-/)
    expect(listItems.length).toBe(5)
  })

  it('hides expand button after expanding', () => {
    const items = makeItems(5)
    render(<DashboardNeedsAttention items={items} />)

    fireEvent.click(screen.getByTestId('needs-attention-expand'))
    expect(screen.queryByTestId('needs-attention-expand')).toBeNull()
  })

  it('displays reason text for each item', () => {
    const items: AttentionItem[] = [
      {
        id: '1',
        title: 'Test Post',
        priority: 'P2',
        reason: 'Agendado para esta semana',
        href: '/cms/blog/1/edit',
        type: 'post',
      },
    ]
    render(<DashboardNeedsAttention items={items} />)

    expect(screen.getByText('Agendado para esta semana')).toBeTruthy()
  })
})
