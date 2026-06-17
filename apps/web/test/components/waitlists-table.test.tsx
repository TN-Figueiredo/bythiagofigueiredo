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
