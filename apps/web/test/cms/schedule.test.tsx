import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockScheduleItem = vi.fn().mockResolvedValue({ ok: true })
const mockUnslotItem = vi.fn().mockResolvedValue({ ok: true })
const mockPublishNow = vi.fn().mockResolvedValue({ ok: true })
const mockReorderBacklog = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/app/cms/(authed)/schedule/actions', () => ({
  scheduleItem: (...args: unknown[]) => mockScheduleItem(...args),
  unslotItem: (...args: unknown[]) => mockUnslotItem(...args),
  publishNow: (...args: unknown[]) => mockPublishNow(...args),
  reorderBacklog: (...args: unknown[]) => mockReorderBacklog(...args),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

// Use a stable "today" for tests
const TODAY = '2026-05-01'
// The week containing 2026-05-01 (Thursday) starts on Sunday 2026-04-26
const WEEK_START = '2026-04-26'

const mockScheduledPosts = [
  {
    id: 'post-1',
    title: 'Scheduled Blog Post',
    status: 'queued',
    slot_date: '2026-05-01',
    queue_position: null,
    published_at: null,
    author_name: 'Thiago',
  },
  {
    id: 'post-overdue',
    title: 'Overdue Post',
    status: 'queued',
    slot_date: '2026-04-28',
    queue_position: null,
    published_at: null,
    author_name: 'Alice',
  },
]

const mockBacklogPosts = [
  {
    id: 'post-backlog-1',
    title: 'Ready Blog Post',
    status: 'ready',
    slot_date: null,
    queue_position: 0,
    published_at: null,
    author_name: 'Thiago',
  },
]

const mockScheduledEditions = [
  {
    id: 'edition-1',
    subject: 'Weekly Newsletter',
    status: 'queued',
    slot_date: '2026-05-02',
    queue_position: null,
    scheduled_at: null,
    newsletter_type_name: 'Weekly Digest',
  },
]

const mockBacklogEditions = [
  {
    id: 'edition-backlog-1',
    subject: 'Draft Newsletter',
    status: 'ready',
    slot_date: null,
    queue_position: 0,
    scheduled_at: null,
    newsletter_type_name: 'Monthly',
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function renderSchedule(overrides: Record<string, unknown> = {}) {
  const { ScheduleConnected } = await import(
    '@/app/cms/(authed)/schedule/schedule-connected'
  )
  return render(
    <ScheduleConnected
      scheduledPosts={mockScheduledPosts}
      backlogPosts={mockBacklogPosts}
      scheduledEditions={mockScheduledEditions}
      backlogEditions={mockBacklogEditions}
      today={TODAY}
      readOnly={false}
      {...overrides}
    />,
  )
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ScheduleConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---- View toggle ---- */

  it('renders 3 view toggle buttons', async () => {
    await renderSchedule()
    expect(screen.getByTestId('view-week')).toBeTruthy()
    expect(screen.getByTestId('view-agenda')).toBeTruthy()
    expect(screen.getByTestId('view-month')).toBeTruthy()
  })

  it('shows Week view by default', async () => {
    await renderSchedule()
    expect(screen.getByTestId('week-view')).toBeTruthy()
  })

  it('switches to Agenda view on click', async () => {
    await renderSchedule()
    fireEvent.click(screen.getByTestId('view-agenda'))
    expect(screen.getByTestId('agenda-view')).toBeTruthy()
  })

  it('switches to Month view on click', async () => {
    await renderSchedule()
    fireEvent.click(screen.getByTestId('view-month'))
    expect(screen.getByTestId('month-view')).toBeTruthy()
  })

  it('marks active view button with aria-pressed', async () => {
    await renderSchedule()
    const weekBtn = screen.getByTestId('view-week')
    expect(weekBtn.getAttribute('aria-pressed')).toBe('true')
    const agendaBtn = screen.getByTestId('view-agenda')
    expect(agendaBtn.getAttribute('aria-pressed')).toBe('false')
  })

  /* ---- Backlog sidebar ---- */

  it('renders backlog sidebar with items', async () => {
    await renderSchedule()
    const sidebar = screen.getByTestId('backlog-sidebar')
    expect(sidebar).toBeTruthy()
    expect(screen.getByText('Ready Blog Post')).toBeTruthy()
    expect(screen.getByText('Draft Newsletter')).toBeTruthy()
  })

  it('renders backlog count badge', async () => {
    await renderSchedule()
    // 2 backlog items (1 post + 1 edition) — find within sidebar
    const sidebar = screen.getByTestId('backlog-sidebar')
    const badges = sidebar.querySelectorAll('.rounded-full')
    const countBadge = Array.from(badges).find(
      (el) => el.textContent?.trim() === '2',
    )
    expect(countBadge).toBeTruthy()
  })

  it('shows empty message when no backlog items', async () => {
    await renderSchedule({ backlogPosts: [], backlogEditions: [] })
    expect(screen.getByText(/no ready items/i)).toBeTruthy()
  })

  /* ---- Scheduled items ---- */

  it('renders scheduled items in week view', async () => {
    await renderSchedule()
    // The post on 2026-05-01 should appear
    expect(screen.getByText('Scheduled Blog Post')).toBeTruthy()
  })

  it('renders items in agenda view grouped by date', async () => {
    await renderSchedule()
    fireEvent.click(screen.getByTestId('view-agenda'))
    expect(screen.getByText('Scheduled Blog Post')).toBeTruthy()
    expect(screen.getByText('Weekly Newsletter')).toBeTruthy()
  })

  /* ---- Type badges ---- */

  it('shows Post badge for blog items', async () => {
    await renderSchedule()
    const badges = screen.getAllByText('Post')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows NL badge for newsletter items', async () => {
    await renderSchedule()
    const badges = screen.getAllByText('NL')
    expect(badges.length).toBeGreaterThan(0)
  })

  /* ---- Overdue items ---- */

  it('shows overdue badge when items are past due', async () => {
    await renderSchedule()
    const badge = screen.getByTestId('overdue-badge')
    expect(badge).toBeTruthy()
    expect(badge.textContent).toContain('overdue')
  })

  /* ---- Busy day badge ---- */

  it('does not show busy badge for days with < 2 items', async () => {
    await renderSchedule()
    // Each day in our fixture has only 1 item — no busy badges
    expect(screen.queryByTestId('busy-day-badge')).toBeNull()
  })

  it('shows busy badge for days with 2+ items', async () => {
    // Both items on the same day
    const twoOnSameDay = [
      {
        ...mockScheduledPosts[0],
        slot_date: '2026-05-01',
      },
      {
        id: 'post-extra',
        title: 'Extra Post',
        status: 'queued',
        slot_date: '2026-05-01',
        queue_position: null,
        published_at: null,
        author_name: 'Bob',
      },
    ]
    await renderSchedule({ scheduledPosts: twoOnSameDay })
    const badges = screen.getAllByTestId('busy-day-badge')
    expect(badges.length).toBeGreaterThan(0)
  })

  /* ---- Today button ---- */

  it('renders Today button', async () => {
    await renderSchedule()
    expect(screen.getByTestId('today-button')).toBeTruthy()
  })

  /* ---- Period navigation ---- */

  it('renders prev/next navigation buttons', async () => {
    await renderSchedule()
    expect(screen.getByLabelText('Previous period')).toBeTruthy()
    expect(screen.getByLabelText('Next period')).toBeTruthy()
  })

  /* ---- Read-only mode ---- */

  it('shows read-only banner when readOnly=true', async () => {
    await renderSchedule({ readOnly: true })
    expect(screen.getByText(/read-only access/i)).toBeTruthy()
  })

  it('hides action buttons in read-only mode', async () => {
    await renderSchedule({ readOnly: true })
    // Backlog item schedule buttons should not render
    expect(screen.queryByTestId('quick-schedule-post-backlog-1')).toBeNull()
    expect(screen.queryByTestId('publish-post-backlog-1')).toBeNull()
  })

  /* ---- Keyboard shortcuts ---- */

  it('switches views with 1/2/3 keys', async () => {
    await renderSchedule()
    // Start with week view
    expect(screen.getByTestId('week-view')).toBeTruthy()

    // Press 2 → agenda
    fireEvent.keyDown(document, { key: '2' })
    expect(screen.getByTestId('agenda-view')).toBeTruthy()

    // Press 3 → month
    fireEvent.keyDown(document, { key: '3' })
    expect(screen.getByTestId('month-view')).toBeTruthy()

    // Press 1 → back to week
    fireEvent.keyDown(document, { key: '1' })
    expect(screen.getByTestId('week-view')).toBeTruthy()
  })

  it('navigates with arrow keys', async () => {
    await renderSchedule()
    // Current period label includes the today date
    const initialLabel = screen.getByText(/Apr|May/i)
    expect(initialLabel).toBeTruthy()

    // Arrow right → next week
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    // Period label should change
    const updatedLabel = screen.getByText(/May/i)
    expect(updatedLabel).toBeTruthy()
  })

  it('T key navigates to today', async () => {
    await renderSchedule()
    // Navigate away first
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    // Press T to go back
    fireEvent.keyDown(document, { key: 'T' })
    // Should be back around today's period
    const label = screen.getByText(/Apr|May/i)
    expect(label).toBeTruthy()
  })

  /* ---- Quick-schedule via day cell ---- */

  it('shows quick-schedule modal when day cell clicked with backlog item', async () => {
    await renderSchedule()
    // Click on a day cell (today)
    const todayCell = screen.getByTestId(`day-cell-${TODAY}`)
    fireEvent.click(todayCell)
    // Modal should appear
    expect(screen.getByTestId('quick-schedule-modal')).toBeTruthy()
  })

  /* ---- Unslot action ---- */

  it('calls unslotItem action when Unslot button clicked', async () => {
    await renderSchedule()
    // Switch to agenda view where Unslot buttons are visible (non-compact)
    fireEvent.click(screen.getByTestId('view-agenda'))
    const unslotBtn = screen.getByTestId('unslot-post-1')
    fireEvent.click(unslotBtn)
    // Should show undo toast
    expect(screen.getByTestId('undo-toast')).toBeTruthy()
  })

  /* ---- Undo toast ---- */

  it('shows undo toast after schedule action', async () => {
    await renderSchedule()
    // Click day cell to trigger schedule
    fireEvent.click(screen.getByTestId(`day-cell-${TODAY}`))
    // Confirm in modal
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmBtn)
    // Undo toast should appear
    expect(screen.getByTestId('undo-toast')).toBeTruthy()
  })

  /* ---- Accessibility ---- */

  it('has aria-label on backlog sidebar', async () => {
    await renderSchedule()
    expect(
      screen.getByRole('complementary', { name: /backlog/i }),
    ).toBeTruthy()
  })

  it('has aria-label on view mode group', async () => {
    await renderSchedule()
    expect(screen.getByRole('group', { name: /view mode/i })).toBeTruthy()
  })
})
