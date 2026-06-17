import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WaitlistsTable } from '../../src/app/cms/(authed)/waitlists/_components/waitlists-table'
import type { WaitlistListRow } from '../../src/app/cms/(authed)/waitlists/queries'

afterEach(cleanup)

const row: WaitlistListRow = {
  id: 'wl-1',
  slug: 'alpha',
  name: 'Alpha',
  status: 'open',
  campaignId: null,
  campaignTitle: null,
  updatedAt: '2026-06-17T00:00:00.000Z',
  signups: 5,
  suppressed: 2,
  description: null,
  intro: null,
  senderName: null,
  senderEmail: null,
  replyTo: null,
}

describe('WaitlistsTable', () => {
  it('renders the name + public slug for a row', () => {
    render(<WaitlistsTable rows={[row]} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('/waitlists/alpha')).toBeTruthy()
  })

  it('renders the signups count + suppressed sub-count', () => {
    const { container } = render(<WaitlistsTable rows={[row]} />)
    expect(screen.getByText('5')).toBeTruthy() // signups
    // suppressed sub-count is a separate `ml-1` span ("−2"); assert via the DOM to stay
    // agnostic to the exact minus glyph (and avoid the badge's own text-xs span).
    const sub = container.querySelector('span.ml-1')
    expect(sub?.textContent).toMatch(/2$/)
  })

  it('renders a linked campaign title when present, em-dash fallback when null', () => {
    render(<WaitlistsTable rows={[{ ...row, id: 'wl-2', campaignTitle: 'Spring Promo' }, row]} />)
    expect(screen.getByText('Spring Promo')).toBeTruthy()
    // the null-campaign row shows the muted em-dash fallback
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('makes the name an accessible button that fires onRowClick', () => {
    const onRowClick = vi.fn()
    render(<WaitlistsTable rows={[row]} onRowClick={onRowClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Alpha/i }))
    expect(onRowClick).toHaveBeenCalledWith(row)
  })

  it('renders the name as static text (no button) when onRowClick is absent', () => {
    render(<WaitlistsTable rows={[row]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
