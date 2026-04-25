import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockMarkReplied = vi.fn().mockResolvedValue({ ok: true })
const mockUndoMarkReplied = vi.fn().mockResolvedValue({ ok: true })
const mockAnonymizeSubmission = vi.fn().mockResolvedValue({ ok: true })
const mockBulkAnonymize = vi.fn().mockResolvedValue({ ok: true })
const mockSendReply = vi.fn().mockResolvedValue({ ok: true })
const mockExportContacts = vi.fn().mockResolvedValue({
  ok: true,
  csv: 'Name,Email\nTest,test@example.com',
  filename: 'contacts-2026-04-24.csv',
})

vi.mock('@/app/cms/(authed)/contacts/actions', () => ({
  markReplied: (...args: unknown[]) => mockMarkReplied(...args),
  undoMarkReplied: (...args: unknown[]) => mockUndoMarkReplied(...args),
  anonymizeSubmission: (...args: unknown[]) => mockAnonymizeSubmission(...args),
  bulkAnonymize: (...args: unknown[]) => mockBulkAnonymize(...args),
  sendReply: (...args: unknown[]) => mockSendReply(...args),
  exportContacts: (...args: unknown[]) => mockExportContacts(...args),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const pendingSub = {
  id: 'sub-1',
  name: 'Alice Pending',
  email: 'alice@example.com',
  message: 'Hello, I need help with my account.',
  submitted_at: '2026-04-20T10:00:00Z',
  replied_at: null,
  anonymized_at: null,
  ip: '192.168.1.1',
  user_agent: 'Mozilla/5.0',
  consent_processing: true,
  consent_marketing: false,
}

const repliedSub = {
  id: 'sub-2',
  name: 'Bob Replied',
  email: 'bob@example.com',
  message: 'Replying to check something important regarding my subscription.',
  submitted_at: '2026-04-18T08:00:00Z',
  replied_at: '2026-04-19T09:00:00Z',
  anonymized_at: null,
  ip: '10.0.0.1',
  user_agent: 'Chrome/100',
  consent_processing: true,
  consent_marketing: true,
}

const anonymizedSub = {
  id: 'sub-3',
  name: 'Anonymous',
  email: 'abc123hash',
  message: '[anonymized per LGPD request]',
  submitted_at: '2026-04-15T12:00:00Z',
  replied_at: null,
  anonymized_at: '2026-04-16T14:00:00Z',
  ip: null,
  user_agent: null,
  consent_processing: true,
  consent_marketing: false,
}

const mockKpis = {
  total: 3,
  totalDelta30d: 2,
  pending: 1,
  oldestPendingDays: 4,
  replied: 1,
  replyRate: 50,
  avgResponseHours: 25,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderContacts(overrides: Record<string, unknown> = {}) {
  const { ContactsConnected } = await import(
    '@/app/cms/(authed)/contacts/contacts-connected'
  )
  return render(
    <ContactsConnected
      submissions={[pendingSub, repliedSub, anonymizedSub]}
      kpis={mockKpis}
      readOnly={false}
      page={1}
      totalPages={1}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ContactsConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- KPI cards ---- */

  it('renders 4 KPI cards', async () => {
    await renderContacts()
    const strip = screen.getByTestId('kpi-strip')
    expect(strip).toBeTruthy()
    expect(strip.children.length).toBe(4)
  })

  it('shows total count in KPI', async () => {
    await renderContacts()
    const strip = screen.getByTestId('kpi-strip')
    // Total KPI card should have the value "3"
    expect(within(strip).getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })

  it('shows pending count in KPI', async () => {
    await renderContacts()
    const strip = screen.getByTestId('kpi-strip')
    // Pending KPI card should have the value "1"
    expect(within(strip).getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  /* ---- Filter tabs ---- */

  it('renders 4 filter tabs', async () => {
    await renderContacts()
    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.length).toBe(4)
  })

  it('defaults to All tab as selected', async () => {
    await renderContacts()
    const allTab = screen.getByRole('tab', { name: /all/i })
    expect(allTab.getAttribute('aria-selected')).toBe('true')
  })

  it('highlights Pendentes tab when clicked', async () => {
    const pushFn = vi.fn()
    const { useRouter } = await import('next/navigation')
    vi.mocked(useRouter).mockReturnValue({
      push: pushFn,
      replace: vi.fn(),
    } as ReturnType<typeof useRouter>)

    await renderContacts()
    fireEvent.click(screen.getByRole('tab', { name: /pendentes/i }))
    expect(pushFn).toHaveBeenCalled()
  })

  /* ---- Table rendering ---- */

  it('renders all submissions in table', async () => {
    await renderContacts()
    expect(screen.getByTestId('contacts-table')).toBeTruthy()
    expect(screen.getByText('Alice Pending')).toBeTruthy()
    expect(screen.getByText('Bob Replied')).toBeTruthy()
    expect(screen.getByText('Anonymous')).toBeTruthy()
  })

  it('shows pending dot for pending submission', async () => {
    await renderContacts()
    const dots = screen.getAllByTestId('pending-dot')
    expect(dots.length).toBe(1)
  })

  it('shows correct status badges', async () => {
    await renderContacts()
    // Status badges in the table
    expect(screen.getAllByText('Pendente').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Respondido').length).toBeGreaterThanOrEqual(1)
    // "Anonymized" appears in tab + status badge
    expect(screen.getAllByText('Anonymized').length).toBeGreaterThanOrEqual(2)
  })

  /* ---- Row variants ---- */

  it('applies bold style to pending rows', async () => {
    await renderContacts()
    const row = screen.getByTestId('contact-row-sub-1')
    expect(row.className).toContain('font-medium')
  })

  it('applies italic + dimmed style to anonymized rows', async () => {
    await renderContacts()
    const row = screen.getByTestId('contact-row-sub-3')
    expect(row.className).toContain('italic')
    expect(row.className).toContain('opacity-60')
  })

  it('disables checkbox for anonymized submission', async () => {
    await renderContacts()
    const row = screen.getByTestId('contact-row-sub-3')
    const checkbox = within(row).getByRole('checkbox') as HTMLInputElement
    expect(checkbox.disabled).toBe(true)
  })

  /* ---- Detail panel ---- */

  it('opens detail panel when row is clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    expect(screen.getByText('Contact Detail')).toBeTruthy()
  })

  it('closes detail panel when close button is clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close panel'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('closes detail panel when backdrop is clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('detail-panel')).toBeTruthy()
    fireEvent.click(screen.getByTestId('detail-backdrop'))
    expect(screen.queryByTestId('detail-panel')).toBeNull()
  })

  it('shows reply button in detail panel for pending submission', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('reply-btn')).toBeTruthy()
  })

  it('shows mark replied button for pending submission', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('mark-replied-btn')).toBeTruthy()
  })

  it('shows undo replied button for replied submission', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Bob Replied'))
    expect(screen.getByTestId('undo-replied-btn')).toBeTruthy()
  })

  it('shows anonymize button in detail panel', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByTestId('anonymize-btn')).toBeTruthy()
  })

  it('shows anonymize confirmation dialog', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    fireEvent.click(screen.getByTestId('anonymize-btn'))
    expect(screen.getByTestId('confirm-anonymize-btn')).toBeTruthy()
    expect(screen.getByText(/permanently anonymize/i)).toBeTruthy()
  })

  /* ---- Mark replied optimistic update ---- */

  it('optimistically updates status when mark replied is clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    fireEvent.click(screen.getByTestId('mark-replied-btn'))
    // After optimistic update, the pending dot should disappear
    // and undo toast should appear
    expect(screen.queryByTestId('mark-replied-btn')).toBeNull()
  })

  /* ---- Quick reply form ---- */

  it('opens reply form when Reply button is clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    fireEvent.click(screen.getByTestId('reply-btn'))
    expect(screen.getByTestId('reply-body')).toBeTruthy()
    expect(screen.getByTestId('send-reply-btn')).toBeTruthy()
  })

  /* ---- Empty state ---- */

  it('shows empty state when no submissions', async () => {
    await renderContacts({ submissions: [] })
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    expect(screen.getByText('No contacts found')).toBeTruthy()
  })

  /* ---- Search ---- */

  it('renders search input', async () => {
    await renderContacts()
    expect(screen.getByTestId('search-input')).toBeTruthy()
  })

  /* ---- Export ---- */

  it('shows export button', async () => {
    await renderContacts()
    expect(screen.getByTestId('export-btn')).toBeTruthy()
  })

  it('opens export dialog when clicked', async () => {
    await renderContacts()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-dialog')).toBeTruthy()
  })

  /* ---- Read-only mode ---- */

  it('hides checkboxes in read-only mode', async () => {
    await renderContacts({ readOnly: true })
    expect(screen.queryByLabelText('Select all')).toBeNull()
  })

  it('hides export button in read-only mode', async () => {
    await renderContacts({ readOnly: true })
    expect(screen.queryByTestId('export-btn')).toBeNull()
  })

  it('hides action buttons in detail panel for read-only', async () => {
    await renderContacts({ readOnly: true })
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.queryByTestId('reply-btn')).toBeNull()
    expect(screen.queryByTestId('mark-replied-btn')).toBeNull()
    expect(screen.queryByTestId('anonymize-btn')).toBeNull()
  })

  /* ---- Pagination ---- */

  it('hides pagination when only 1 page', async () => {
    await renderContacts({ totalPages: 1 })
    expect(screen.queryByTestId('pagination')).toBeNull()
  })

  it('shows pagination when multiple pages', async () => {
    await renderContacts({ totalPages: 3, page: 2 })
    const pagination = screen.getByTestId('pagination')
    expect(pagination).toBeTruthy()
    expect(screen.getByText(/page 2 of 3/i)).toBeTruthy()
  })

  /* ---- Bulk actions ---- */

  it('shows bulk actions bar when items are selected', async () => {
    await renderContacts()
    const row = screen.getByTestId('contact-row-sub-1')
    const checkbox = within(row).getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(screen.getByTestId('bulk-actions')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  /* ---- Select all ---- */

  it('select all toggles selection for non-anonymized items', async () => {
    await renderContacts()
    const selectAll = screen.getByLabelText('Select all')
    fireEvent.click(selectAll)
    expect(screen.getByTestId('bulk-actions')).toBeTruthy()
    expect(screen.getByText('2 selected')).toBeTruthy()
  })

  /* ---- Consent display in detail ---- */

  it('shows consent info in detail panel', async () => {
    await renderContacts()
    fireEvent.click(screen.getByText('Alice Pending'))
    expect(screen.getByText('Processing consent')).toBeTruthy()
    expect(screen.getByText('Marketing consent')).toBeTruthy()
  })

  /* ---- Message preview in table ---- */

  it('truncates message preview in table', async () => {
    const longMessageSub = {
      ...pendingSub,
      id: 'sub-long',
      message: 'A'.repeat(200),
    }
    await renderContacts({
      submissions: [longMessageSub],
    })
    // The table should truncate at 80 chars
    const table = screen.getByTestId('contacts-table')
    const preview = table.textContent
    // 83 = 80 chars + "..."
    expect(preview).toContain('A'.repeat(80) + '...')
  })
})
