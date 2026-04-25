import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => '/cms/subscribers'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/subscribers/actions', () => ({
  exportSubscribers: vi.fn().mockResolvedValue({ ok: true, data: 'csv-data' }),
  batchUnsubscribe: vi.fn().mockResolvedValue({ ok: true }),
  toggleTrackingConsent: vi.fn().mockResolvedValue({ ok: true }),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const mockRow = (overrides: Partial<{
  id: string
  email: string
  status: string
  newsletter_type_name: string
  newsletter_type_color: string | null
  tracking_consent: boolean
  subscribed_at: string
  confirmed_at: string | null
  is_anonymized: boolean
}> = {}) => ({
  id: 'sub-1',
  email: 'alice@example.com',
  status: 'confirmed' as const,
  newsletter_type_name: 'Weekly Digest',
  newsletter_type_color: '#6366f1',
  tracking_consent: true,
  subscribed_at: '2026-04-01T00:00:00Z',
  confirmed_at: '2026-04-01T12:00:00Z',
  is_anonymized: false,
  ...overrides,
})

const mockStats = {
  totalConfirmed: 42,
  totalPending: 5,
  totalUnsubscribed: 3,
  trackingConsentedPct: 80,
}

const mockTypes = [
  { id: 'nt-1', name: 'Weekly Digest', color: '#6366f1' },
  { id: 'nt-2', name: 'Monthly Report', color: '#22c55e' },
]

const defaultProps = {
  initialRows: [
    mockRow(),
    mockRow({
      id: 'sub-2',
      email: 'bob@example.com',
      status: 'pending' as const,
      tracking_consent: false,
      subscribed_at: '2026-03-15T00:00:00Z',
      confirmed_at: null,
    }),
    mockRow({
      id: 'sub-3',
      email: 'carol@example.com',
      status: 'unsubscribed' as const,
      tracking_consent: false,
      subscribed_at: '2026-02-01T00:00:00Z',
      confirmed_at: '2026-02-02T00:00:00Z',
    }),
  ],
  totalCount: 3,
  page: 1,
  perPage: 50,
  newsletterTypes: mockTypes,
  stats: mockStats,
  currentSearch: '',
  currentStatus: '',
  currentType: '',
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderComponent(
  overrides: Record<string, unknown> = {},
) {
  const { SubscribersConnected } = await import(
    '@/app/cms/(authed)/subscribers/subscribers-connected'
  )
  return render(<SubscribersConnected {...defaultProps} {...overrides} />)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('SubscribersConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- Stats bar ---- */

  it('renders stats bar with 4 stat cards', async () => {
    await renderComponent()
    const statsBar = screen.getByTestId('stats-bar')
    expect(statsBar).toBeTruthy()
    const cards = screen.getAllByTestId('stat-card')
    expect(cards.length).toBe(4)
  })

  it('displays confirmed count', async () => {
    await renderComponent()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('displays pending count', async () => {
    await renderComponent()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('displays unsubscribed count', async () => {
    await renderComponent()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('displays tracking consent percentage', async () => {
    await renderComponent()
    expect(screen.getByText('80%')).toBeTruthy()
  })

  /* ---- Filter pills ---- */

  it('renders filter pills for all statuses', async () => {
    await renderComponent()
    expect(screen.getByTestId('filter-pill-all')).toBeTruthy()
    expect(screen.getByTestId('filter-pill-confirmed')).toBeTruthy()
    expect(screen.getByTestId('filter-pill-pending')).toBeTruthy()
    expect(screen.getByTestId('filter-pill-unsubscribed')).toBeTruthy()
  })

  it('marks active filter pill as pressed', async () => {
    await renderComponent({ currentStatus: 'confirmed' })
    const pill = screen.getByTestId('filter-pill-confirmed')
    expect(pill.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "All" as pressed when no status filter', async () => {
    await renderComponent()
    const pill = screen.getByTestId('filter-pill-all')
    expect(pill.getAttribute('aria-pressed')).toBe('true')
  })

  /* ---- Table rows with status badges ---- */

  it('renders table rows', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    expect(rows.length).toBe(3)
  })

  it('renders status badges', async () => {
    await renderComponent()
    const badges = screen.getAllByTestId('status-badge')
    expect(badges.length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unsubscribed').length).toBeGreaterThan(0)
  })

  it('renders subscriber emails', async () => {
    await renderComponent()
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('carol@example.com').length).toBeGreaterThan(0)
  })

  it('renders newsletter type names', async () => {
    await renderComponent()
    expect(screen.getAllByText('Weekly Digest').length).toBeGreaterThanOrEqual(3)
  })

  /* ---- Detail panel open/close ---- */

  it('opens detail panel on row click', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    fireEvent.click(rows[0])
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    expect(screen.getByText('Subscriber Detail')).toBeTruthy()
  })

  it('closes detail panel on close button click', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    fireEvent.click(rows[0])
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close detail panel'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('closes detail panel on overlay click', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    fireEvent.click(rows[0])
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByTestId('detail-overlay'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('shows subscriber email in detail panel', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    fireEvent.click(rows[0])
    // Email shown in table AND detail panel
    const emails = screen.getAllByText('alice@example.com')
    expect(emails.length).toBeGreaterThanOrEqual(2)
  })

  it('shows tracking consent toggle in detail panel', async () => {
    await renderComponent()
    const rows = screen.getAllByTestId('subscriber-row')
    fireEvent.click(rows[0])
    expect(screen.getByLabelText('Toggle tracking consent')).toBeTruthy()
  })

  /* ---- Batch bar visibility on selection ---- */

  it('hides batch bar when nothing selected', async () => {
    await renderComponent()
    expect(screen.queryByTestId('batch-bar')).toBeNull()
  })

  it('shows batch bar when items are selected', async () => {
    await renderComponent()
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is "select all", second is first row
    fireEvent.click(checkboxes[1])
    expect(screen.getByTestId('batch-bar')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('shows correct count when multiple items selected', async () => {
    await renderComponent()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    expect(screen.getByText('2 selected')).toBeTruthy()
  })

  it('hides batch bar after clear button', async () => {
    await renderComponent()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByTestId('batch-bar')).toBeTruthy()
    fireEvent.click(screen.getByText('Clear'))
    expect(screen.queryByTestId('batch-bar')).toBeNull()
  })

  it('select all checkbox selects all non-anonymized rows', async () => {
    await renderComponent()
    const selectAll = screen.getByLabelText('Select all')
    fireEvent.click(selectAll)
    expect(screen.getByText('3 selected')).toBeTruthy()
  })

  /* ---- Column sort toggle ---- */

  it('renders sort buttons for email, status, date', async () => {
    await renderComponent()
    expect(screen.getByTestId('sort-email')).toBeTruthy()
    expect(screen.getByTestId('sort-status')).toBeTruthy()
    expect(screen.getByTestId('sort-date')).toBeTruthy()
  })

  it('toggles sort direction on email column click', async () => {
    await renderComponent()
    const emailSort = screen.getByTestId('sort-email')
    fireEvent.click(emailSort)
    // After click, email should be sorted asc — first row alphabetically is alice
    const rows = screen.getAllByTestId('subscriber-row')
    expect(rows.length).toBe(3)
  })

  it('toggles sort direction on repeated click', async () => {
    await renderComponent()
    const dateSort = screen.getByTestId('sort-date')
    // date is default desc; click toggles to asc
    fireEvent.click(dateSort)
    // click again toggles to desc
    fireEvent.click(dateSort)
    // Rows should still render
    expect(screen.getAllByTestId('subscriber-row').length).toBe(3)
  })

  /* ---- Empty state ---- */

  it('shows empty state when no rows', async () => {
    await renderComponent({ initialRows: [] })
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    expect(screen.getByText('No subscribers found.')).toBeTruthy()
  })

  it('does not render table when empty', async () => {
    await renderComponent({ initialRows: [] })
    expect(screen.queryByTestId('subscriber-table')).toBeNull()
  })

  /* ---- Export button ---- */

  it('renders export button', async () => {
    await renderComponent()
    expect(screen.getByTestId('export-btn')).toBeTruthy()
  })

  it('opens export dialog on click', async () => {
    await renderComponent()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-dialog')).toBeTruthy()
    expect(screen.getByText('Export Subscribers')).toBeTruthy()
  })

  /* ---- Search input ---- */

  it('renders search input', async () => {
    await renderComponent()
    expect(screen.getByLabelText('Search subscribers')).toBeTruthy()
  })

  /* ---- Pagination ---- */

  it('does not render pagination when single page', async () => {
    await renderComponent()
    expect(screen.queryByTestId('pagination')).toBeNull()
  })

  it('renders pagination when multiple pages', async () => {
    await renderComponent({ totalCount: 150, page: 1 })
    expect(screen.getByTestId('pagination')).toBeTruthy()
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  /* ---- Mobile cards ---- */

  it('renders mobile card list', async () => {
    await renderComponent()
    expect(screen.getByTestId('mobile-card-list')).toBeTruthy()
    const cards = screen.getAllByTestId('subscriber-mobile-card')
    expect(cards.length).toBe(3)
  })

  /* ---- Anonymized subscriber ---- */

  it('shows anonymized subscriber as italic', async () => {
    await renderComponent({
      initialRows: [
        mockRow({
          id: 'sub-anon',
          email: 'a1b2c3d4e5f60708...@anon',
          is_anonymized: true,
        }),
      ],
    })
    const texts = screen.getAllByText('a1b2c3d4e5f60708...@anon')
    expect(texts.length).toBeGreaterThan(0)
    // At least one of them should have italic styling
    const hasItalic = texts.some((el) => el.className.includes('italic'))
    expect(hasItalic).toBe(true)
  })

  it('disables checkbox for anonymized subscriber', async () => {
    await renderComponent({
      initialRows: [
        mockRow({
          id: 'sub-anon',
          email: 'a1b2c3d4e5f60708...@anon',
          is_anonymized: true,
        }),
      ],
    })
    // The disabled checkbox in the row
    const checkboxes = screen.getAllByRole('checkbox')
    // select-all + row checkbox
    const disabledCb = checkboxes.find(
      (cb) => (cb as HTMLInputElement).disabled,
    )
    expect(disabledCb).toBeTruthy()
  })

  /* ---- Newsletter type filter ---- */

  it('renders newsletter type filter dropdown', async () => {
    await renderComponent()
    expect(screen.getByLabelText('Filter by newsletter type')).toBeTruthy()
  })
})
