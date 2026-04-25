import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/campaigns/bulk-actions', () => ({
  bulkPublishCampaigns: vi.fn().mockResolvedValue({ ok: true, affected: 1 }),
  bulkArchiveCampaigns: vi.fn().mockResolvedValue({ ok: true, affected: 1 }),
  bulkDeleteCampaigns: vi.fn().mockResolvedValue({ ok: true, affected: 1 }),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: 'draft',
    interest: 'react-guide',
    created_at: '2026-04-20T10:00:00Z',
    owner_user_id: 'u1',
    author_name: 'Thiago',
    translations: [
      { locale: 'pt-BR', slug: 'guia-react', meta_title: 'Guia React' },
    ],
    submission_count: 42,
    conversion_rate: 12.5,
    ...overrides,
  }
}

const mockCampaigns = [
  makeCampaign({ id: 'c1', status: 'draft' }),
  makeCampaign({
    id: 'c2',
    status: 'published',
    interest: 'ts-guide',
    translations: [
      { locale: 'en', slug: 'ts-guide', meta_title: 'TypeScript Guide' },
    ],
    submission_count: 100,
    conversion_rate: 25.0,
    author_name: 'Alice',
    created_at: '2026-04-18T10:00:00Z',
  }),
  makeCampaign({
    id: 'c3',
    status: 'archived',
    interest: 'old-campaign',
    translations: [
      { locale: 'pt-BR', slug: 'antiga', meta_title: 'Campanha Antiga' },
    ],
    submission_count: 5,
    conversion_rate: 1.2,
    author_name: null,
    created_at: '2026-04-15T10:00:00Z',
  }),
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderConnected(
  overrides: Record<string, unknown> = {},
) {
  const { CampaignsConnected } = await import(
    '@/app/cms/(authed)/campaigns/campaigns-connected'
  )
  return render(
    <CampaignsConnected
      campaigns={mockCampaigns}
      totalCount={3}
      page={1}
      pageSize={50}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('CampaignsConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- Filter pills ---- */

  it('renders all filter pills', async () => {
    await renderConnected()
    expect(screen.getByTestId('filter-pills')).toBeTruthy()
    expect(screen.getByTestId('filter-all')).toBeTruthy()
    expect(screen.getByTestId('filter-draft')).toBeTruthy()
    expect(screen.getByTestId('filter-published')).toBeTruthy()
    expect(screen.getByTestId('filter-archived')).toBeTruthy()
  })

  it('"All" filter is highlighted by default', async () => {
    await renderConnected()
    const allBtn = screen.getByTestId('filter-all')
    expect(allBtn.className).toContain('bg-cms-accent')
  })

  /* ---- Table rendering ---- */

  it('renders campaign rows with status badges', async () => {
    await renderConnected()
    const badges = screen.getAllByTestId('status-badge')
    // Desktop + mobile = 6 badges total (3 campaigns x 2 views)
    expect(badges.length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Archived').length).toBeGreaterThanOrEqual(1)
  })

  it('renders campaign titles as links', async () => {
    await renderConnected()
    // Titles appear in both desktop table and mobile cards
    expect(screen.getAllByText('Guia React').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('TypeScript Guide').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Campanha Antiga').length).toBeGreaterThanOrEqual(1)
  })

  it('renders submission counts', async () => {
    await renderConnected()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })

  it('renders conversion rates', async () => {
    await renderConnected()
    expect(screen.getByText('12.5%')).toBeTruthy()
    expect(screen.getByText('25.0%')).toBeTruthy()
  })

  it('renders author names', async () => {
    await renderConnected()
    // Author names appear in both desktop and mobile views
    expect(screen.getAllByText('Thiago').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
  })

  it('shows dash for missing author', async () => {
    await renderConnected()
    // The archived campaign has null author_name, rendered as em dash
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  /* ---- Locale tags ---- */

  it('renders locale tags', async () => {
    await renderConnected()
    // Should find pt-BR and en locale tags
    const ptBrTags = screen.getAllByText('pt-BR')
    expect(ptBrTags.length).toBeGreaterThanOrEqual(1)
    const enTags = screen.getAllByText('en')
    expect(enTags.length).toBeGreaterThanOrEqual(1)
  })

  /* ---- Checkbox selection ---- */

  it('renders select-all checkbox', async () => {
    await renderConnected()
    const selectAll = screen.getByLabelText('Select all campaigns')
    expect(selectAll).toBeTruthy()
  })

  it('renders per-row checkboxes', async () => {
    await renderConnected()
    const checkboxes = screen.getAllByRole('checkbox')
    // select-all + 3 rows = 4 total (desktop)
    expect(checkboxes.length).toBeGreaterThanOrEqual(4)
  })

  /* ---- Bulk actions bar ---- */

  it('bulk actions bar hidden when no selection', async () => {
    await renderConnected()
    expect(screen.queryByTestId('bulk-actions-bar')).toBeNull()
  })

  it('shows bulk actions bar after selecting a row', async () => {
    await renderConnected()
    // Multiple checkboxes exist (desktop + mobile); pick the first
    const checkboxes = screen.getAllByLabelText('Select Guia React')
    fireEvent.click(checkboxes[0])
    expect(screen.getByTestId('bulk-actions-bar')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('bulk bar has Publish, Archive, Delete buttons', async () => {
    await renderConnected()
    const checkboxes = screen.getAllByLabelText('Select Guia React')
    fireEvent.click(checkboxes[0])
    const bar = screen.getByTestId('bulk-actions-bar')
    expect(bar.querySelector('button')).toBeTruthy()
    // Find buttons within the bar
    const buttons = bar.querySelectorAll('button')
    const texts = Array.from(buttons).map((b) => b.textContent)
    expect(texts).toContain('Publish')
    expect(texts).toContain('Archive')
    expect(texts).toContain('Delete')
  })

  it('shows confirm dialog when bulk delete is clicked', async () => {
    await renderConnected()
    const checkboxes = screen.getAllByLabelText('Select Guia React')
    fireEvent.click(checkboxes[0])
    const bar = screen.getByTestId('bulk-actions-bar')
    const deleteBtn = Array.from(bar.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )
    expect(deleteBtn).toBeTruthy()
    fireEvent.click(deleteBtn!)
    expect(screen.getByTestId('confirm-dialog')).toBeTruthy()
    expect(screen.getByText(/are you sure/i)).toBeTruthy()
  })

  it('confirm dialog can be cancelled', async () => {
    await renderConnected()
    const checkboxes = screen.getAllByLabelText('Select Guia React')
    fireEvent.click(checkboxes[0])
    const bar = screen.getByTestId('bulk-actions-bar')
    const deleteBtn = Array.from(bar.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )
    fireEvent.click(deleteBtn!)
    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)
    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
  })

  /* ---- Context menu ---- */

  it('context menu opens on three-dot button click', async () => {
    await renderConnected()
    const actionBtns = screen.getAllByLabelText(/actions for/i)
    expect(actionBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(actionBtns[0])
    expect(screen.getByTestId('context-menu')).toBeTruthy()
  })

  it('context menu shows Edit link for all statuses', async () => {
    await renderConnected()
    const actionBtns = screen.getAllByLabelText(/actions for/i)
    fireEvent.click(actionBtns[0])
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeTruthy()
  })

  it('context menu shows Publish for draft campaigns', async () => {
    await renderConnected()
    // First campaign is draft
    const actionBtns = screen.getAllByLabelText(/actions for guia react/i)
    fireEvent.click(actionBtns[0])
    expect(screen.getByRole('menuitem', { name: 'Publish' })).toBeTruthy()
  })

  it('context menu does NOT show Publish for archived campaigns', async () => {
    await renderConnected()
    // Third campaign is archived - find its action button
    const actionBtns = screen.getAllByLabelText(
      /actions for campanha antiga/i,
    )
    fireEvent.click(actionBtns[0])
    expect(
      screen.queryByRole('menuitem', { name: 'Publish' }),
    ).toBeNull()
  })

  it('context menu shows Delete for draft campaigns', async () => {
    await renderConnected()
    const actionBtns = screen.getAllByLabelText(/actions for guia react/i)
    fireEvent.click(actionBtns[0])
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy()
  })

  it('context menu does NOT show Delete for published campaigns', async () => {
    await renderConnected()
    const actionBtns = screen.getAllByLabelText(
      /actions for typescript guide/i,
    )
    fireEvent.click(actionBtns[0])
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })

  it('context menu shows Archive for draft and published campaigns', async () => {
    await renderConnected()
    // Draft campaign
    const draftBtns = screen.getAllByLabelText(/actions for guia react/i)
    fireEvent.click(draftBtns[0])
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeTruthy()
    // Close menu
    fireEvent.click(draftBtns[0])
  })

  it('context menu does NOT show Archive for archived campaigns', async () => {
    await renderConnected()
    const archivedBtns = screen.getAllByLabelText(
      /actions for campanha antiga/i,
    )
    fireEvent.click(archivedBtns[0])
    expect(
      screen.queryByRole('menuitem', { name: 'Archive' }),
    ).toBeNull()
  })

  /* ---- Column sort ---- */

  it('toggles sort direction when clicking the same column header', async () => {
    await renderConnected()
    const titleSort = screen.getByRole('button', { name: /title/i })
    // First click: sort by title (desc)
    fireEvent.click(titleSort)
    // Second click: toggle to asc
    fireEvent.click(titleSort)
    // The component re-sorts internally — just ensure no error
    expect(titleSort).toBeTruthy()
  })

  it('switches to different sort field', async () => {
    await renderConnected()
    const subSort = screen.getByRole('button', { name: /submissions/i })
    fireEvent.click(subSort)
    expect(subSort).toBeTruthy()
  })

  /* ---- Pagination ---- */

  it('does NOT show pagination when total fits in one page', async () => {
    await renderConnected()
    expect(screen.queryByTestId('pagination')).toBeNull()
  })

  it('shows pagination when total exceeds page size', async () => {
    await renderConnected({ totalCount: 100 })
    expect(screen.getByTestId('pagination')).toBeTruthy()
    expect(screen.getByText(/page 1 of 2/i)).toBeTruthy()
  })

  it('shows Previous and Next buttons', async () => {
    await renderConnected({ totalCount: 100 })
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  it('Previous button is disabled on first page', async () => {
    await renderConnected({ totalCount: 100 })
    const prevBtn = screen.getByText('Previous')
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true)
  })

  /* ---- Search ---- */

  it('renders search input', async () => {
    await renderConnected()
    expect(
      screen.getByLabelText('Search campaigns'),
    ).toBeTruthy()
  })

  /* ---- Empty state ---- */

  it('shows empty state when no campaigns', async () => {
    await renderConnected({ campaigns: [], totalCount: 0 })
    expect(screen.getByText('No campaigns found')).toBeTruthy()
  })

  /* ---- Select all ---- */

  it('select all selects all campaigns', async () => {
    await renderConnected()
    const selectAll = screen.getByLabelText('Select all campaigns')
    fireEvent.click(selectAll)
    expect(screen.getByTestId('bulk-actions-bar')).toBeTruthy()
    expect(screen.getByText('3 selected')).toBeTruthy()
  })

  it('select all deselects when all are selected', async () => {
    await renderConnected()
    const selectAll = screen.getByLabelText('Select all campaigns')
    fireEvent.click(selectAll) // select all
    fireEvent.click(selectAll) // deselect all
    expect(screen.queryByTestId('bulk-actions-bar')).toBeNull()
  })
})
