import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { SignupsTab } from '../../src/app/cms/(authed)/waitlists/_components/signups-tab'
import type { WaitlistDetailData, SignupsPage } from '../../src/app/cms/(authed)/waitlists/queries'

afterEach(cleanup)

const detail: WaitlistDetailData = {
  id: 'wl-1',
  slug: 'a',
  name: 'A',
  status: 'open',
  description: null,
  intro: null,
  campaignId: null,
  senderName: null,
  senderEmail: null,
  replyTo: null,
  sourceCounts: { landing: 0, embed: 0, tiptap: 0 },
  pending: 0,
  suppressed: 0,
}

const page: SignupsPage = {
  rows: [
    { id: 's1', email: 'a@x.com', status: 'pending', suppressionReason: null, sourceSurface: 'landing', createdAt: '2026-06-10T12:00:00.000Z' },
    { id: 's2', email: 'b@x.com', status: 'suppressed', suppressionReason: 'bounce', sourceSurface: null, createdAt: '2026-06-10T11:00:00.000Z' },
  ],
  nextCursor: { createdAt: '2026-06-10T11:00:00.000Z', id: 's2' },
  estimatedTotal: 2,
}

describe('<SignupsTab>', () => {
  it('renders rows with source label + suppression reason, and the status filter pills', () => {
    render(<SignupsTab detail={detail} page={page} filters={{ status: 'pending', q: 'foo' }} />)
    expect(screen.getByText('a@x.com')).toBeTruthy()
    expect(screen.getByText('Landing page')).toBeTruthy() // landing → shared label
    // em dash appears for null source AND null suppression-reason cells
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('bounce')).toBeTruthy() // suppression reason in its own column

    // Active filter is marked for AT; "All" preserves the q filter but drops status.
    expect(screen.getByRole('link', { name: 'Pending' })).toHaveAttribute('aria-current', 'page')
    const all = screen.getByRole('link', { name: 'All' })
    expect(all.getAttribute('href')).toContain('q=foo')
    expect(all.getAttribute('href')).not.toContain('status=')
  })

  it('renders a Next link that round-trips the cursor in ?c', () => {
    render(<SignupsTab detail={detail} page={page} filters={{}} />)
    const next = screen.getByRole('link', { name: /next/i })
    expect(decodeURIComponent(next.getAttribute('href') ?? '')).toContain('c=2026-06-10T11:00:00.000Z|s2')
  })

  it('shows the empty state and no Next link when there are no rows / no cursor', () => {
    render(<SignupsTab detail={detail} page={{ rows: [], nextCursor: null, estimatedTotal: 0 }} filters={{}} />)
    expect(screen.getByText(/no signups match/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /next/i })).toBeNull()
  })
})
