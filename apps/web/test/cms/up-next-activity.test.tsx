// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

// The component lives inside (authed), a parenthesized route group.
// Mock all @/ imports that the component uses so the test resolves correctly.
vi.mock('@/lib/pipeline/colors', () => ({
  getFormatColor: vi.fn(() => ({ accent: '#888', bg: '#111', text: '#fff', border: '#333' })),
}))

vi.mock('lucide-react', () => ({
  ChevronDown: ({ size, style, className }: Record<string, unknown>) => (
    <svg data-testid="chevron-icon" width={size as number} style={style as React.CSSProperties} className={className as string} />
  ),
}))

/* ------------------------------------------------------------------ */
/*  Import (relative path — avoids @/ alias issues with parenthesized dirs) */
/* ------------------------------------------------------------------ */

import {
  UpNextActivity,
  type ActivityEntry,
} from '../../src/app/cms/(authed)/pipeline/_components/up-next-activity'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: '1',
    code: 'G1-test',
    format: 'video',
    event_type: 'created',
    to_value: null,
    changed_at: new Date().toISOString(),
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('UpNextActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when entries is empty', () => {
    const { container } = render(<UpNextActivity entries={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders collapsed by default — activity entries not visible', () => {
    render(<UpNextActivity entries={[makeEntry()]} />)

    expect(screen.getByTestId('activity-section')).toBeTruthy()
    expect(screen.getByText('Atividade Recente')).toBeTruthy()
    expect(screen.queryByTestId('activity-list')).toBeNull()
  })

  it('expands on header click and shows entries', () => {
    render(<UpNextActivity entries={[makeEntry({ code: 'G7-click' })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))

    expect(screen.getByTestId('activity-list')).toBeTruthy()
    expect(screen.getByText('G7-click')).toBeTruthy()
  })

  it('collapses again on second click', () => {
    render(<UpNextActivity entries={[makeEntry()]} />)

    const toggle = screen.getByTestId('activity-toggle')
    fireEvent.click(toggle)
    expect(screen.getByTestId('activity-list')).toBeTruthy()

    fireEvent.click(toggle)
    expect(screen.queryByTestId('activity-list')).toBeNull()
  })

  it('shows relative time for recent entries', () => {
    render(
      <UpNextActivity
        entries={[makeEntry({ changed_at: new Date().toISOString() })]}
      />,
    )

    fireEvent.click(screen.getByTestId('activity-toggle'))

    const timeEl = screen.getByTestId('activity-time')
    expect(timeEl.textContent).toBe('agora')
  })

  it('shows "Xmin" for entries minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    render(<UpNextActivity entries={[makeEntry({ changed_at: fiveMinutesAgo })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))

    const timeEl = screen.getByTestId('activity-time')
    expect(timeEl.textContent).toBe('5min')
  })

  it('shows "Xh" for entries hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    render(<UpNextActivity entries={[makeEntry({ changed_at: twoHoursAgo })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))

    const timeEl = screen.getByTestId('activity-time')
    expect(timeEl.textContent).toBe('2h')
  })

  it('shows "Xd" for entries days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    render(<UpNextActivity entries={[makeEntry({ changed_at: threeDaysAgo })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))

    const timeEl = screen.getByTestId('activity-time')
    expect(timeEl.textContent).toBe('3d')
  })

  it('shows correct event label for stage_change', () => {
    render(
      <UpNextActivity
        entries={[makeEntry({ event_type: 'stage_change', to_value: 'roteiro' })]}
      />,
    )

    fireEvent.click(screen.getByTestId('activity-toggle'))
    expect(screen.getByText('moveu para roteiro')).toBeTruthy()
  })

  it('shows correct event label for created', () => {
    render(<UpNextActivity entries={[makeEntry({ event_type: 'created' })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))
    expect(screen.getByText('criado')).toBeTruthy()
  })

  it('shows correct event label for archived', () => {
    render(<UpNextActivity entries={[makeEntry({ event_type: 'archived' })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))
    expect(screen.getByText('arquivado')).toBeTruthy()
  })

  it('shows correct event label for restored', () => {
    render(<UpNextActivity entries={[makeEntry({ event_type: 'restored' })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))
    expect(screen.getByText('restaurado')).toBeTruthy()
  })

  it('shows correct event label for graduated', () => {
    render(<UpNextActivity entries={[makeEntry({ event_type: 'graduated' })]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))
    expect(screen.getByText('graduado')).toBeTruthy()
  })

  it('renders colored dot for each entry format', () => {
    render(<UpNextActivity entries={[makeEntry()]} />)

    fireEvent.click(screen.getByTestId('activity-toggle'))

    const dot = screen.getByTestId('activity-dot')
    expect(dot.style.backgroundColor).toBe('#888')
  })

  it('activity list has id="activity-list" when expanded', () => {
    render(<UpNextActivity entries={[makeEntry()]} />)
    fireEvent.click(screen.getByTestId('activity-toggle'))
    const list = screen.getByTestId('activity-list')
    expect(list.id).toBe('activity-list')
  })

  it('toggle button has aria-controls pointing to activity-list', () => {
    render(<UpNextActivity entries={[makeEntry()]} />)
    const toggle = screen.getByTestId('activity-toggle')
    expect(toggle.getAttribute('aria-controls')).toBe('activity-list')
  })
})
