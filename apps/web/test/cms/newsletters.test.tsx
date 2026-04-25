import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

/* ─── Mocks ─── */

const routerPush = vi.fn()
const routerRefresh = vi.fn()
let searchParamsMap = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  useSearchParams: () => searchParamsMap,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const retryEditionMock = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/app/cms/(authed)/newsletters/actions', () => ({
  retryEdition: (...args: unknown[]) => retryEditionMock(...args),
}))

/* ─── Fixtures ─── */

function makeType(overrides: Partial<{
  id: string; name: string; color: string; subscribers: number;
  avgOpenRate: number; lastSent: string | null; cadence: string;
  editionCount: number; isPaused: boolean;
}> = {}) {
  return {
    id: 'type-1',
    name: 'Weekly Digest',
    color: '#ea580c',
    subscribers: 120,
    avgOpenRate: 42.5,
    lastSent: '2026-04-20',
    cadence: 'Weekly',
    editionCount: 10,
    isPaused: false,
    ...overrides,
  }
}

function makeEdition(overrides: Partial<{
  id: string; subject: string; status: string; newsletter_type_id: string;
  newsletter_type_name: string; newsletter_type_color: string;
  stats_delivered: number | null; stats_opens: number | null; stats_clicks: number | null;
  stats_bounces: number | null; total_subscribers: number | null;
  sent_at: string | null; scheduled_at: string | null;
  created_at: string | null; updated_at: string | null;
  error_message: string | null; retry_count: number | null; max_retries: number | null;
  source_post_id: string | null; is_best_performer: boolean;
}> = {}) {
  return {
    id: 'ed-1',
    subject: 'Test Edition',
    status: 'sent' as const,
    newsletter_type_id: 'type-1',
    newsletter_type_name: 'Weekly Digest',
    newsletter_type_color: '#ea580c',
    stats_delivered: 100,
    stats_opens: 45,
    stats_clicks: 12,
    stats_bounces: 2,
    total_subscribers: 120,
    sent_at: '2026-04-20T08:00:00Z',
    scheduled_at: null,
    created_at: '2026-04-19T10:00:00Z',
    updated_at: '2026-04-20T08:00:00Z',
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    source_post_id: null,
    is_best_performer: false,
    ...overrides,
  }
}

function makeKpis(overrides: Partial<{
  uniqueSubscribers: number; editionsSent30d: number;
  avgOpenRate30d: number; avgOpenRateDelta: number | null; bounceRate: number;
}> = {}) {
  return {
    uniqueSubscribers: 350,
    editionsSent30d: 8,
    avgOpenRate30d: 38.5,
    avgOpenRateDelta: 2.3,
    bounceRate: 1.2,
    ...overrides,
  }
}

function makeLastEdition(overrides: Partial<{
  id: string; subject: string; sentAt: string;
  delivered: number; opens: number; clicks: number; openRate: number;
}> = {}) {
  return {
    id: 'ed-last',
    subject: 'Last Weekly',
    sentAt: '2026-04-20T08:00:00Z',
    delivered: 340,
    opens: 152,
    clicks: 47,
    openRate: 44.7,
    ...overrides,
  }
}

/* ─── Import after mocks ─── */

import { NewslettersConnected } from '@/app/cms/(authed)/newsletters/newsletters-connected'

function renderConnected(overrides: {
  types?: ReturnType<typeof makeType>[];
  editions?: ReturnType<typeof makeEdition>[];
  kpis?: ReturnType<typeof makeKpis>;
  lastEdition?: ReturnType<typeof makeLastEdition> | null;
  totalEditions?: number;
} = {}) {
  const props = {
    types: overrides.types ?? [makeType()],
    editions: overrides.editions ?? [makeEdition()],
    kpis: overrides.kpis ?? makeKpis(),
    lastEdition: overrides.lastEdition !== undefined ? overrides.lastEdition : makeLastEdition(),
    totalEditions: overrides.totalEditions ?? 1,
  }
  return render(<NewslettersConnected {...props} />)
}

/* ─── Tests ─── */

describe('NewslettersConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMap = new URLSearchParams()
    retryEditionMock.mockResolvedValue({ ok: true })
  })

  /* ── Module exports ── */

  describe('module exports', () => {
    it('exports NewslettersConnected component', async () => {
      const mod = await import('@/app/cms/(authed)/newsletters/newsletters-connected')
      expect(mod.NewslettersConnected).toBeDefined()
    })

    it('exports TypeCards component', async () => {
      const mod = await import('@/app/cms/(authed)/newsletters/_components/type-cards')
      expect(mod.TypeCards).toBeDefined()
    })
  })

  /* ── KPI Strip ── */

  describe('KPI strip', () => {
    it('renders 4 KPI cards', () => {
      renderConnected()
      const kpiStrip = screen.getByTestId('newsletter-kpis')
      expect(kpiStrip).toBeTruthy()
      expect(screen.getByTestId('kpi-unique-subs')).toBeTruthy()
      expect(screen.getByTestId('kpi-editions-sent')).toBeTruthy()
      expect(screen.getByTestId('kpi-avg-open-rate')).toBeTruthy()
      expect(screen.getByTestId('kpi-bounce-rate')).toBeTruthy()
    })

    it('displays unique subscribers count', () => {
      renderConnected({ kpis: makeKpis({ uniqueSubscribers: 1500 }) })
      const card = screen.getByTestId('kpi-unique-subs')
      expect(card.textContent).toContain('1,500')
    })

    it('displays editions sent in last 30d', () => {
      renderConnected({ kpis: makeKpis({ editionsSent30d: 12 }) })
      const card = screen.getByTestId('kpi-editions-sent')
      expect(card.textContent).toContain('12')
    })

    it('displays avg open rate with delta', () => {
      renderConnected({ kpis: makeKpis({ avgOpenRate30d: 38.5, avgOpenRateDelta: 2.3 }) })
      const card = screen.getByTestId('kpi-avg-open-rate')
      expect(card.textContent).toContain('38.5%')
      expect(card.textContent).toContain('+2.3pp')
    })

    it('displays negative delta', () => {
      renderConnected({ kpis: makeKpis({ avgOpenRate30d: 25.0, avgOpenRateDelta: -3.1 }) })
      const card = screen.getByTestId('kpi-avg-open-rate')
      expect(card.textContent).toContain('-3.1pp')
    })

    it('displays bounce rate with health label', () => {
      renderConnected({ kpis: makeKpis({ bounceRate: 1.2 }) })
      const card = screen.getByTestId('kpi-bounce-rate')
      expect(card.textContent).toContain('1.2%')
      expect(card.textContent).toContain('healthy')
    })

    it('shows warning for bounce rate 2-5%', () => {
      renderConnected({ kpis: makeKpis({ bounceRate: 3.5 }) })
      const card = screen.getByTestId('kpi-bounce-rate')
      expect(card.textContent).toContain('warning')
    })

    it('shows auto-pause for bounce rate >5%', () => {
      renderConnected({ kpis: makeKpis({ bounceRate: 6.2 }) })
      const card = screen.getByTestId('kpi-bounce-rate')
      expect(card.textContent).toContain('auto-pause')
    })
  })

  /* ── Last Newsletter Banner ── */

  describe('last newsletter banner', () => {
    it('renders banner with stats when last edition exists', () => {
      renderConnected({ lastEdition: makeLastEdition({ subject: 'My Newsletter #5', delivered: 500, openRate: 45.2, clicks: 80 }) })
      const banner = screen.getByTestId('last-newsletter-banner')
      expect(banner.textContent).toContain('My Newsletter #5')
      expect(banner.textContent).toContain('500')
      expect(banner.textContent).toContain('45.2%')
      expect(banner.textContent).toContain('80')
    })

    it('does not render banner when no last edition', () => {
      renderConnected({ lastEdition: null })
      expect(screen.queryByTestId('last-newsletter-banner')).toBeNull()
    })

    it('shows "Last Newsletter" label', () => {
      renderConnected()
      const banner = screen.getByTestId('last-newsletter-banner')
      expect(banner.textContent).toContain('Last Newsletter')
    })
  })

  /* ── Type Card Integration ── */

  describe('type cards', () => {
    it('renders type cards section', () => {
      const types = [
        makeType({ id: 'type-1', name: 'Alpha Newsletter' }),
        makeType({ id: 'type-2', name: 'Product Updates', color: '#22c55e' }),
      ]
      // Use editions with different type names to avoid duplicate text matches
      const editions = [makeEdition({ newsletter_type_name: 'Other Type' })]
      renderConnected({ types, editions })
      expect(screen.getAllByText('Alpha Newsletter').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Product Updates')).toBeTruthy()
    })

    it('passes selectedTypeId from URL params', () => {
      searchParamsMap = new URLSearchParams('type=type-2')
      const types = [
        makeType({ id: 'type-1', name: 'Type A' }),
        makeType({ id: 'type-2', name: 'Type B' }),
      ]
      renderConnected({ types })
      // Type B button should have the accent border (selected)
      const buttons = document.querySelectorAll('button')
      const typeBBtn = Array.from(buttons).find((b) => b.textContent?.includes('Type B'))
      expect(typeBBtn?.className).toContain('border-cms-accent')
    })
  })

  /* ── Status Filters ── */

  describe('status filters', () => {
    it('renders all status filter buttons', () => {
      renderConnected()
      const filterBar = screen.getByTestId('status-filters')
      expect(filterBar.textContent).toContain('all')
      expect(filterBar.textContent).toContain('draft')
      expect(filterBar.textContent).toContain('sent')
      expect(filterBar.textContent).toContain('failed')
      expect(filterBar.textContent).toContain('scheduled')
    })

    it('highlights active status from URL', () => {
      searchParamsMap = new URLSearchParams('status=sent')
      renderConnected()
      const sentBtn = screen.getByTestId('filter-sent')
      expect(sentBtn.className).toContain('bg-cms-accent')
    })

    it('navigates on status click', () => {
      renderConnected()
      const draftBtn = screen.getByTestId('filter-draft')
      fireEvent.click(draftBtn)
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('status=draft'))
    })

    it('clears status filter on "all" click', () => {
      searchParamsMap = new URLSearchParams('status=sent')
      renderConnected()
      const allBtn = screen.getByTestId('filter-all')
      fireEvent.click(allBtn)
      expect(routerPush).toHaveBeenCalled()
      const url = routerPush.mock.calls[0]![0] as string
      expect(url).not.toContain('status=')
    })
  })

  /* ── Search ── */

  describe('search', () => {
    it('renders search input', () => {
      renderConnected()
      expect(screen.getByTestId('edition-search')).toBeTruthy()
    })

    it('filters editions by subject', async () => {
      const editions = [
        makeEdition({ id: 'ed-1', subject: 'Weekly Update #1' }),
        makeEdition({ id: 'ed-2', subject: 'Monthly Recap' }),
      ]
      renderConnected({ editions, totalEditions: 2 })

      const input = screen.getByTestId('edition-search') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Monthly' } })

      // Should filter immediately on client side
      expect(screen.queryByText('Weekly Update #1')).toBeNull()
      expect(screen.getByText('Monthly Recap')).toBeTruthy()
    })
  })

  /* ── Editions Table ── */

  describe('editions table', () => {
    it('renders table with column headers', () => {
      renderConnected()
      const table = screen.getByTestId('editions-table')
      expect(table).toBeTruthy()
      expect(screen.getByTestId('sort-subject')).toBeTruthy()
      expect(screen.getByTestId('sort-type')).toBeTruthy()
      expect(screen.getByTestId('sort-delivered')).toBeTruthy()
      expect(screen.getByTestId('sort-opens')).toBeTruthy()
      expect(screen.getByTestId('sort-clicks')).toBeTruthy()
      expect(screen.getByTestId('sort-date')).toBeTruthy()
    })

    it('renders edition rows', () => {
      const editions = [
        makeEdition({ id: 'ed-1', subject: 'Edition Alpha' }),
        makeEdition({ id: 'ed-2', subject: 'Edition Beta' }),
      ]
      renderConnected({ editions, totalEditions: 2 })
      expect(screen.getByTestId('edition-row-ed-1')).toBeTruthy()
      expect(screen.getByTestId('edition-row-ed-2')).toBeTruthy()
    })

    it('shows empty state when no editions', () => {
      renderConnected({ editions: [], totalEditions: 0 })
      expect(screen.getByTestId('empty-zero')).toBeTruthy()
      expect(screen.getByText('No editions yet')).toBeTruthy()
    })

    it('shows filtered empty state when filters active but no results', () => {
      searchParamsMap = new URLSearchParams('status=failed')
      renderConnected({ editions: [], totalEditions: 0 })
      expect(screen.getByTestId('empty-filtered')).toBeTruthy()
    })
  })

  /* ── Row Variants ── */

  describe('row variants', () => {
    it('renders sending row with animated dot and progress bar', () => {
      const edition = makeEdition({
        id: 'ed-sending',
        status: 'sending',
        stats_delivered: 50,
        total_subscribers: 200,
      })
      renderConnected({ editions: [edition] })
      const row = screen.getByTestId('edition-row-ed-sending')
      expect(row).toBeTruthy()
      expect(screen.getByTestId('status-badge-sending')).toBeTruthy()
      expect(screen.getByTestId('sending-progress')).toBeTruthy()
      expect(screen.getByTestId('sending-progress').textContent).toContain('50/200')
    })

    it('renders best performer badge on sent edition', () => {
      const edition = makeEdition({
        id: 'ed-best',
        status: 'sent',
        is_best_performer: true,
        stats_delivered: 100,
        stats_opens: 60,
      })
      renderConnected({ editions: [edition] })
      expect(screen.getByTestId('best-performer-badge')).toBeTruthy()
    })

    it('renders scheduled badge with datetime', () => {
      const edition = makeEdition({
        id: 'ed-sched',
        status: 'scheduled',
        scheduled_at: '2026-04-25T10:00:00Z',
      })
      renderConnected({ editions: [edition] })
      expect(screen.getByTestId('status-badge-scheduled')).toBeTruthy()
    })

    it('renders draft from post indicator', () => {
      const edition = makeEdition({
        id: 'ed-from-post',
        status: 'draft',
        source_post_id: 'post-123',
      })
      renderConnected({ editions: [edition] })
      expect(screen.getByTestId('source-post-indicator')).toBeTruthy()
    })

    it('renders failed row with red background and error message', () => {
      const edition = makeEdition({
        id: 'ed-fail',
        status: 'failed',
        error_message: 'Resend API rate limit',
      })
      renderConnected({ editions: [edition] })
      const row = screen.getByTestId('edition-row-ed-fail')
      expect(row.className).toContain('ef4444')
      expect(screen.getByTestId('error-message').textContent).toContain('Resend API rate limit')
    })
  })

  /* ── Sort ── */

  describe('sort', () => {
    it('toggles sort direction on column header click', () => {
      renderConnected()
      const subjectSort = screen.getByTestId('sort-subject')
      fireEvent.click(subjectSort)
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('sort=subject'))
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('dir=desc'))
    })

    it('reverses direction on same column click', () => {
      searchParamsMap = new URLSearchParams('sort=subject&dir=desc')
      renderConnected()
      const subjectSort = screen.getByTestId('sort-subject')
      fireEvent.click(subjectSort)
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('dir=asc'))
    })

    it('sorts editions by subject client-side', () => {
      const editions = [
        makeEdition({ id: 'ed-b', subject: 'Beta Edition' }),
        makeEdition({ id: 'ed-a', subject: 'Alpha Edition' }),
      ]
      searchParamsMap = new URLSearchParams('sort=subject&dir=asc')
      renderConnected({ editions, totalEditions: 2 })

      const rows = screen.getAllByTestId(/^edition-row-/)
      expect(rows[0]!.getAttribute('data-testid')).toBe('edition-row-ed-a')
      expect(rows[1]!.getAttribute('data-testid')).toBe('edition-row-ed-b')
    })
  })

  /* ── Context Menu ── */

  describe('context menu', () => {
    it('opens menu on click', () => {
      const edition = makeEdition({ id: 'ed-1', status: 'draft' })
      renderConnected({ editions: [edition] })
      const menuBtn = screen.getByTestId('ctx-menu-btn-ed-1')
      fireEvent.click(menuBtn)
      expect(screen.getByTestId('ctx-menu-ed-1')).toBeTruthy()
    })

    it('shows Edit/Test/Duplicate/Delete for draft', () => {
      const edition = makeEdition({ id: 'ed-1', status: 'draft' })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-1'))
      const menu = screen.getByTestId('ctx-menu-ed-1')
      expect(menu.textContent).toContain('Edit')
      expect(menu.textContent).toContain('Send Test')
      expect(menu.textContent).toContain('Duplicate')
      expect(menu.textContent).toContain('Delete')
    })

    it('shows Edit/Cancel/Reschedule for scheduled', () => {
      const edition = makeEdition({ id: 'ed-s', status: 'scheduled' })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-s'))
      const menu = screen.getByTestId('ctx-menu-ed-s')
      expect(menu.textContent).toContain('Edit')
      expect(menu.textContent).toContain('Cancel')
      expect(menu.textContent).toContain('Reschedule')
    })

    it('shows Archive/Analytics/Duplicate for sent', () => {
      const edition = makeEdition({ id: 'ed-sent', status: 'sent' })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-sent'))
      const menu = screen.getByTestId('ctx-menu-ed-sent')
      expect(menu.textContent).toContain('Archive')
      expect(menu.textContent).toContain('Analytics')
      expect(menu.textContent).toContain('Duplicate')
    })

    it('shows Retry/Edit/Delete for failed edition with remaining retries', () => {
      const edition = makeEdition({ id: 'ed-f', status: 'failed', retry_count: 1, max_retries: 3 })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-f'))
      const menu = screen.getByTestId('ctx-menu-ed-f')
      expect(menu.textContent).toContain('Retry')
      expect(menu.textContent).toContain('2 remaining')
      expect(menu.textContent).toContain('Edit')
      expect(menu.textContent).toContain('Delete')
    })

    it('disables retry when max retries exceeded', () => {
      const edition = makeEdition({ id: 'ed-f2', status: 'failed', retry_count: 3, max_retries: 3 })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-f2'))
      const retryBtn = screen.getByTestId('ctx-action-retry')
      expect(retryBtn.hasAttribute('disabled')).toBe(true)
    })

    it('does not show context menu for sending status', () => {
      const edition = makeEdition({ id: 'ed-sending', status: 'sending' })
      renderConnected({ editions: [edition] })
      // The menu button should not render (no items)
      expect(screen.queryByTestId('ctx-menu-btn-ed-sending')).toBeNull()
    })

    it('closes on Escape key', () => {
      const edition = makeEdition({ id: 'ed-1', status: 'draft' })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-1'))
      expect(screen.getByTestId('ctx-menu-ed-1')).toBeTruthy()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByTestId('ctx-menu-ed-1')).toBeNull()
    })
  })

  /* ── Retry Action ── */

  describe('retry action', () => {
    it('calls retryEdition on retry click', async () => {
      const edition = makeEdition({ id: 'ed-fail', status: 'failed', retry_count: 0, max_retries: 3 })
      renderConnected({ editions: [edition] })
      fireEvent.click(screen.getByTestId('ctx-menu-btn-ed-fail'))
      const retryBtn = screen.getByTestId('ctx-action-retry')
      fireEvent.click(retryBtn)
      // retryEdition should be called with the edition id
      await vi.waitFor(() => {
        expect(retryEditionMock).toHaveBeenCalledWith('ed-fail')
      })
    })
  })

  /* ── Pagination ── */

  describe('pagination', () => {
    it('shows pagination when editions exceed page size', () => {
      const editions = Array.from({ length: 25 }, (_, i) =>
        makeEdition({ id: `ed-${i}`, subject: `Edition ${i}` }),
      )
      renderConnected({ editions, totalEditions: 25 })
      expect(screen.getByTestId('pagination')).toBeTruthy()
      expect(screen.getByTestId('pagination').textContent).toContain('Page 1 of 2')
    })

    it('hides pagination when editions fit on one page', () => {
      const editions = [makeEdition()]
      renderConnected({ editions, totalEditions: 1 })
      expect(screen.queryByTestId('pagination')).toBeNull()
    })

    it('navigates to next page', () => {
      const editions = Array.from({ length: 25 }, (_, i) =>
        makeEdition({ id: `ed-${i}`, subject: `Edition ${i}` }),
      )
      renderConnected({ editions, totalEditions: 25 })
      fireEvent.click(screen.getByTestId('page-next'))
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('page=2'))
    })
  })

  /* ── New Edition Button ── */

  describe('new edition button', () => {
    it('renders new edition link', () => {
      renderConnected()
      const btn = screen.getByTestId('new-edition-btn')
      expect(btn).toBeTruthy()
      expect(btn.getAttribute('href')).toBe('/cms/newsletters/new')
    })
  })
})

/* ─── Server Action Tests ─── */

describe('retryEdition action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is exported from actions module', async () => {
    const mod = await import('@/app/cms/(authed)/newsletters/actions')
    expect(typeof mod.retryEdition).toBe('function')
  })
})

/* ─── Page.tsx Tests ─── */

describe('newsletter dashboard page module', () => {
  it('exports default function', async () => {
    // We need to mock the dependencies that the page imports
    vi.mock('@/lib/cms/admin', () => ({
      cms: {
        newsletters: {
          listTypes: vi.fn().mockResolvedValue([]),
          listEditions: vi.fn().mockResolvedValue({ editions: [] }),
        },
      },
    }))

    vi.mock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({ data: [], count: 0 }),
                  data: [],
                  count: 0,
                }),
                data: [],
                count: 0,
              }),
              gte: vi.fn().mockResolvedValue({ data: [], count: 0 }),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
              in: vi.fn().mockResolvedValue({ data: [], count: 0 }),
              data: [],
              count: 0,
            }),
          }),
        }),
      }),
    }))

    vi.mock('@/lib/cms/site-context', () => ({
      getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
    }))

    vi.mock('@tn-figueiredo/cms-ui/client', () => ({
      CmsTopbar: ({ title }: { title: string }) => <div>{title}</div>,
      CmsButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    }))

    const mod = await import('@/app/cms/(authed)/newsletters/page')
    expect(typeof mod.default).toBe('function')
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
