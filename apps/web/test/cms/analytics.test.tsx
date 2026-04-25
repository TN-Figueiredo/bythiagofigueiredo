import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: mockReplace })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/app/cms/(authed)/analytics/actions', () => ({
  fetchOverview: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      postsPublished: 12,
      totalViews: 340,
      subscribers: 89,
      openRate: 42,
      prevPostsPublished: null,
      prevTotalViews: null,
      prevSubscribers: null,
      prevOpenRate: null,
    },
  }),
  fetchNewsletterStats: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'ed-1',
        subject: 'Weekly Update #1',
        sent_at: '2026-04-20T08:00:00Z',
        stats_delivered: 100,
        stats_opens: 45,
        stats_clicks: 12,
        stats_bounces: 3,
      },
    ],
  }),
  fetchCampaignStats: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'camp-1',
        title: 'Spring Campaign',
        status: 'published',
        submissions_count: 25,
        published_at: '2026-04-01T10:00:00Z',
      },
    ],
  }),
  fetchContentStats: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'post-1',
        title: 'Getting Started with React 19',
        locale: 'en',
        status: 'published',
        published_at: '2026-04-15T12:00:00Z',
        owner_user_id: 'u1',
      },
    ],
  }),
  refreshStats: vi.fn().mockResolvedValue({ ok: true }),
  exportReport: vi.fn().mockResolvedValue({
    ok: true,
    data: '{"overview":{}}',
  }),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const defaultOverview = {
  postsPublished: 12,
  totalViews: 340,
  subscribers: 89,
  openRate: 42,
  prevPostsPublished: null,
  prevTotalViews: null,
  prevSubscribers: null,
  prevOpenRate: null,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderAnalytics(overrides: Record<string, unknown> = {}) {
  const { AnalyticsTabsConnected } = await import(
    '@/app/cms/(authed)/analytics/analytics-tabs-connected'
  )
  return render(
    <AnalyticsTabsConnected
      initialTab="overview"
      initialPeriod="30d"
      initialCompare={false}
      initialOverview={defaultOverview}
      canExport={true}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('AnalyticsTabsConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- 4 tabs render ---- */

  it('renders all 4 tab buttons', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('tab-overview')).toBeTruthy()
    expect(screen.getByTestId('tab-newsletters')).toBeTruthy()
    expect(screen.getByTestId('tab-campaigns')).toBeTruthy()
    expect(screen.getByTestId('tab-content')).toBeTruthy()
  })

  it('renders tab labels', async () => {
    await renderAnalytics()
    expect(screen.getByText('Overview')).toBeTruthy()
    expect(screen.getByText('Newsletters')).toBeTruthy()
    expect(screen.getByText('Campaigns')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
  })

  /* ---- Period selector ---- */

  it('renders period selector buttons', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('period-7d')).toBeTruthy()
    expect(screen.getByTestId('period-30d')).toBeTruthy()
    expect(screen.getByTestId('period-90d')).toBeTruthy()
  })

  it('highlights active period', async () => {
    await renderAnalytics()
    const btn30d = screen.getByTestId('period-30d')
    expect(btn30d.className).toContain('bg-indigo-500')
  })

  it('switches period on click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('period-7d'))
    const btn7d = screen.getByTestId('period-7d')
    expect(btn7d.className).toContain('bg-indigo-500')
  })

  /* ---- Compare toggle ---- */

  it('renders compare toggle', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('compare-toggle')).toBeTruthy()
    expect(screen.getByText('Compare')).toBeTruthy()
  })

  it('compare toggle is unchecked by default', async () => {
    await renderAnalytics()
    const toggle = screen.getByTestId('compare-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })

  it('toggles compare on click', async () => {
    await renderAnalytics()
    const toggle = screen.getByTestId('compare-toggle') as HTMLInputElement
    fireEvent.click(toggle)
    expect(toggle.checked).toBe(true)
  })

  /* ---- Tab switching ---- */

  it('shows overview tab content by default', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('kpi-posts-published')).toBeTruthy()
    expect(screen.getByTestId('kpi-total-views')).toBeTruthy()
    expect(screen.getByTestId('kpi-subscribers')).toBeTruthy()
    expect(screen.getByTestId('kpi-open-rate')).toBeTruthy()
  })

  it('displays KPI values', async () => {
    await renderAnalytics()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('340')).toBeTruthy()
    expect(screen.getByText('89')).toBeTruthy()
  })

  it('switches to newsletters tab on click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('tab-newsletters'))
    // Newsletter tab should show the edition stats section
    // (may be loading or show empty state initially)
    const tab = screen.getByTestId('tab-newsletters')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches to campaigns tab on click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('tab-campaigns'))
    const tab = screen.getByTestId('tab-campaigns')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches to content tab on click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('tab-content'))
    const tab = screen.getByTestId('tab-content')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('overview tab has aria-selected=true by default', async () => {
    await renderAnalytics()
    const tab = screen.getByTestId('tab-overview')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  /* ---- Export button ---- */

  it('shows export button when canExport is true', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('export-btn')).toBeTruthy()
  })

  it('hides export button when canExport is false', async () => {
    await renderAnalytics({ canExport: false })
    expect(screen.queryByTestId('export-btn')).toBeNull()
  })

  /* ---- Export dialog open/close ---- */

  it('opens export dialog on export button click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-dialog')).toBeTruthy()
    expect(screen.getByText('Export Report')).toBeTruthy()
  })

  it('export dialog has format radio buttons', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByRole('radio', { name: /csv/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /json/i })).toBeTruthy()
  })

  it('export dialog has section checkboxes', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('export-btn'))
    const checkboxes = screen.getAllByRole('checkbox')
    // 4 section checkboxes (overview, newsletters, campaigns, content)
    // plus the compare toggle = 5 total, but the export dialog has its own
    const sectionCheckboxes = checkboxes.filter(
      (cb) => cb.getAttribute('data-testid') !== 'compare-toggle',
    )
    expect(sectionCheckboxes.length).toBe(4)
  })

  it('export dialog has cancel and download buttons', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-cancel')).toBeTruthy()
    expect(screen.getByTestId('export-download')).toBeTruthy()
  })

  it('closes export dialog on cancel click', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('export-cancel'))
    // Dialog should be gone
    expect(screen.queryByTestId('export-dialog')).toBeNull()
  })

  /* ---- Refresh button ---- */

  it('shows refresh button', async () => {
    await renderAnalytics()
    expect(screen.getByTestId('refresh-btn')).toBeTruthy()
  })

  /* ---- Keyboard shortcuts ---- */

  it('switches to tab 2 on key "2"', async () => {
    await renderAnalytics()
    fireEvent.keyDown(document, { key: '2' })
    const tab = screen.getByTestId('tab-newsletters')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches to tab 3 on key "3"', async () => {
    await renderAnalytics()
    fireEvent.keyDown(document, { key: '3' })
    const tab = screen.getByTestId('tab-campaigns')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches to tab 4 on key "4"', async () => {
    await renderAnalytics()
    fireEvent.keyDown(document, { key: '4' })
    const tab = screen.getByTestId('tab-content')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('switches back to tab 1 on key "1"', async () => {
    await renderAnalytics()
    fireEvent.keyDown(document, { key: '2' })
    fireEvent.keyDown(document, { key: '1' })
    const tab = screen.getByTestId('tab-overview')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('does not trigger shortcuts when input is focused', async () => {
    await renderAnalytics()
    // Focus on compare toggle input and press key
    const toggle = screen.getByTestId('compare-toggle')
    fireEvent.keyDown(toggle, { key: '2' })
    // Should NOT switch tabs because target is an INPUT
    const tab = screen.getByTestId('tab-overview')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  /* ---- URL state sync ---- */

  it('syncs tab change to URL', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('tab-newsletters'))
    expect(mockReplace).toHaveBeenCalled()
    const url = mockReplace.mock.calls[0][0] as string
    expect(url).toContain('tab=newsletters')
  })

  it('syncs period change to URL', async () => {
    await renderAnalytics()
    fireEvent.click(screen.getByTestId('period-7d'))
    expect(mockReplace).toHaveBeenCalled()
    const url = mockReplace.mock.calls[0][0] as string
    expect(url).toContain('period=7d')
  })

  /* ---- Overview empty state ---- */

  it('shows no data message when overview is null', async () => {
    await renderAnalytics({ initialOverview: null })
    expect(screen.getByText('No data available.')).toBeTruthy()
  })

  /* ---- Topbar ---- */

  it('renders the Analytics heading', async () => {
    await renderAnalytics()
    expect(screen.getByText('Analytics')).toBeTruthy()
  })

  /* ---- Accessibility ---- */

  it('has tablist role on navigation', async () => {
    await renderAnalytics()
    expect(screen.getByRole('tablist', { name: /analytics tabs/i })).toBeTruthy()
  })

  it('tab buttons have role=tab', async () => {
    await renderAnalytics()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(4)
  })

  it('has period selector group role', async () => {
    await renderAnalytics()
    expect(screen.getByRole('group', { name: /period selector/i })).toBeTruthy()
  })
})
