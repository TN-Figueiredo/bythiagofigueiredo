import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/cms/newsletters'),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn().mockReturnValue(new Map()),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site', orgId: 'test-org', defaultLocale: 'en' }),
}))

vi.mock('@/lib/auth/scope', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock newsletter actions used by ScheduleTab and child components
vi.mock('@/app/cms/(authed)/newsletters/actions', () => ({
  toggleCadence: vi.fn().mockResolvedValue({ ok: true }),
  getAvailableSlots: vi.fn().mockResolvedValue({ ok: true, slots: [] }),
  scheduleEditionToSlot: vi.fn().mockResolvedValue({ ok: true }),
  scheduleEditionAsSpecial: vi.fn().mockResolvedValue({ ok: true }),
  swapSlotEdition: vi.fn().mockResolvedValue({ ok: true }),
  updateCadencePattern: vi.fn().mockResolvedValue({ ok: true }),
  updateSendTime: vi.fn().mockResolvedValue({ ok: true }),
  moveEdition: vi.fn().mockResolvedValue({ ok: true }),
  retryEdition: vi.fn().mockResolvedValue({ ok: true }),
  toggleWorkflow: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock lib/newsletter/cadence-slots used by CadenceCard
vi.mock('@/lib/newsletter/cadence-slots', () => ({
  describePattern: vi.fn().mockReturnValue('Weekly on Mon'),
  generateCadenceSlots: vi.fn().mockReturnValue([]),
  computeScheduledAt: vi.fn().mockReturnValue(new Date()),
}))

// Mock lib/newsletter/format used by CadenceCard
vi.mock('@/lib/newsletter/format', () => ({
  normalizeTime: vi.fn((t: string) => t ?? '08:00'),
  parseUserAgent: vi.fn().mockReturnValue({ browser: 'Chrome', device: 'Desktop' }),
}))

// Mock seo cache-invalidation used by actions
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateNewsletterTypeSeo: vi.fn(),
  revalidateBlogPostSeo: vi.fn(),
  revalidateCampaignSeo: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Import component under test (after all mocks)                     */
/* ------------------------------------------------------------------ */

import { ScheduleTab } from '../../src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab'
import { en } from '../../src/app/cms/(authed)/newsletters/_i18n/en'
import type { ScheduleTabData } from '../../src/app/cms/(authed)/newsletters/_hub/hub-types'

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeScheduleTabData(overrides: Partial<ScheduleTabData> = {}): ScheduleTabData {
  return {
    healthStrip: {
      fillRate: 75,
      next7Days: 3,
      missed: 1,
      failed: 0,
      activeTypes: 2,
      totalTypes: 3,
    },
    calendarSlots: [],
    cadenceConfigs: [
      {
        typeId: 'type-weekly',
        typeName: 'Weekly Digest',
        typeColor: '#ea580c',
        cadence: 'Every 7 days',
        hasPattern: true,
        cadenceDays: 7,
        dayOfWeek: 'Monday',
        time: '08:00',
        nextDate: '2026-05-13',
        cadenceStartDate: null,
        cadencePattern: { type: 'weekly', days: ['mon'] },
        paused: false,
        subscribers: 120,
        editionsSent: 10,
        openRate: 42.5,
        conflicts: [],
      },
      {
        typeId: 'type-monthly',
        typeName: 'Monthly Roundup',
        typeColor: '#22c55e',
        cadence: 'Monthly',
        hasPattern: true,
        cadenceDays: 30,
        dayOfWeek: 'Monday',
        time: '09:00',
        nextDate: '2026-06-01',
        cadenceStartDate: null,
        cadencePattern: { type: 'monthly_last_day' },
        paused: false,
        subscribers: 80,
        editionsSent: 5,
        openRate: 35.0,
        conflicts: [],
      },
    ],
    sendWindow: {
      time: '08:00',
      timezone: 'America/Sao_Paulo',
      bestTimeInsight: 'Best open rates on Tuesday mornings',
    },
    readyEditions: [],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ScheduleTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders health strip metrics', () => {
    const data = makeScheduleTabData()
    render(<ScheduleTab data={data} strings={en} />)

    // Fill Rate metric: 75% (toFixed(0) = "75")
    expect(screen.getByText('75%')).toBeTruthy()
    // Next 7 Days metric: 3 (may appear multiple times in summary bar too, use getAllByText)
    const threeInstances = screen.getAllByText('3')
    expect(threeInstances.length).toBeGreaterThan(0)
    // Metric labels from en strings
    expect(screen.getByText('Fill Rate')).toBeTruthy()
    expect(screen.getByText('Next 7 Days')).toBeTruthy()
  })

  it('renders cadence config cards', () => {
    const data = makeScheduleTabData()
    render(<ScheduleTab data={data} strings={en} />)

    // Both type names should appear
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
    expect(screen.getByText('Monthly Roundup')).toBeTruthy()
  })

  it('shows empty state when no cadence configs', () => {
    const data = makeScheduleTabData({ cadenceConfigs: [] })
    render(<ScheduleTab data={data} strings={en} />)

    // EmptyState renders the heading from strings.empty.configCadence (appears as both heading and description)
    const emptyHeadings = screen.getAllByText('Configure cadence for your newsletter types')
    expect(emptyHeadings.length).toBeGreaterThan(0)
  })

  it('filters cadence configs by typeFilter', () => {
    const data = makeScheduleTabData()
    render(<ScheduleTab data={data} typeFilter="type-weekly" strings={en} />)

    // Only Weekly Digest should be rendered in cadence section
    expect(screen.getByText('Weekly Digest')).toBeTruthy()
    // Monthly Roundup should NOT appear (filtered out)
    expect(screen.queryByText('Monthly Roundup')).toBeNull()
  })

  it('renders send window with timezone', () => {
    const data = makeScheduleTabData()
    render(<ScheduleTab data={data} strings={en} />)

    // The send window shows "08:00 (America/Sao_Paulo)"
    const sendWindowEl = screen.getByText(/America\/Sao_Paulo/)
    expect(sendWindowEl).toBeTruthy()
    expect(sendWindowEl.textContent).toContain('08:00')
    expect(sendWindowEl.textContent).toContain('America/Sao_Paulo')
  })

  it('renders summary bar with edition/type counts', () => {
    const data = makeScheduleTabData()
    render(<ScheduleTab data={data} strings={en} />)

    expect(screen.getAllByText(/editions/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Active Types/).length).toBeGreaterThan(0)
  })

  it('does not render custom toast div (uses sonner)', () => {
    const data = makeScheduleTabData()
    const { container } = render(<ScheduleTab data={data} strings={en} />)

    // The old pattern was a fixed div in the bottom-right corner
    // The new implementation uses sonner — there must be no such element
    const toastDivs = container.querySelectorAll('.fixed.bottom-6.right-6')
    expect(toastDivs).toHaveLength(0)
  })
})
