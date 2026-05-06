import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/* ─── Mocks (must be before imports) ─── */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
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

// Mock the actions module (server action imported by cadence-card)
vi.mock('@/app/cms/(authed)/newsletters/actions', () => ({
  updateCadencePattern: vi.fn().mockResolvedValue({ ok: true }),
  saveEdition: vi.fn().mockResolvedValue({ ok: true }),
  scheduleEdition: vi.fn().mockResolvedValue({ ok: true }),
}))

/* ─── Imports after mocks ─── */

import { CadenceCard, legacyToPattern } from '../../src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card'
import type { CadenceConfig } from '../../src/app/cms/(authed)/newsletters/_hub/hub-types'

function makeConfig(overrides: Partial<CadenceConfig> = {}): CadenceConfig {
  return {
    typeId: 'type-1',
    typeName: 'Weekly Digest',
    typeColor: '#6366f1',
    cadence: 'Weekly, Mon',
    hasPattern: false,
    cadenceDays: 7,
    dayOfWeek: 'Mon',
    time: '09:00:00',
    nextDate: '2026-05-12',
    cadenceStartDate: '2026-05-05',
    cadencePattern: null,
    paused: false,
    subscribers: 42,
    editionsSent: 10,
    openRate: 55.3,
    conflicts: [],
    ...overrides,
  }
}

describe('CadenceCard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders collapsed with normalized time (strips seconds)', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByText(/09:00/)).toBeTruthy()
    expect(screen.queryByText(/09:00:00/)).toBeNull()
  })

  it('renders collapsed with describePattern when cadencePattern exists', () => {
    render(
      <CadenceCard
        config={makeConfig({ cadencePattern: { type: 'biweekly', day: 'wed' }, hasPattern: true })}
        siteTimezone="America/Sao_Paulo"
        locale="pt-BR"
      />,
    )
    // biweekly in pt-BR → "A cada 2 semanas na Quarta"
    expect(screen.getByText(/2 semanas/i)).toBeTruthy()
  })

  it('expands on chevron click', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.getByTestId('cadence-form-type-1')).toBeTruthy()
  })

  it('collapses when already expanded', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.getByTestId('cadence-form-type-1')).toBeTruthy()
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.queryByTestId('cadence-form-type-1')).toBeNull()
  })

  it('shows pause button with correct label when paused', () => {
    render(<CadenceCard config={makeConfig({ paused: true })} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByLabelText('Resume cadence')).toBeTruthy()
  })

  it('shows pause button with correct label when not paused', () => {
    render(<CadenceCard config={makeConfig({ paused: false })} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByLabelText('Pause cadence')).toBeTruthy()
  })

  it('shows conflict badge when multiple conflicts exist', () => {
    render(
      <CadenceCard config={makeConfig({ conflicts: ['2026-05-10', '2026-05-17'] })} siteTimezone="America/Sao_Paulo" locale="en" />,
    )
    expect(screen.getByText(/2 conflicts/)).toBeTruthy()
  })

  it('shows singular conflict badge for single conflict', () => {
    render(
      <CadenceCard config={makeConfig({ conflicts: ['2026-05-10'] })} siteTimezone="America/Sao_Paulo" locale="en" />,
    )
    expect(screen.getByText(/1 conflict/)).toBeTruthy()
  })

  it('renders subscriber count and open rate', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByText(/42/)).toBeTruthy()
    expect(screen.getByText(/55%/)).toBeTruthy()
  })
})

describe('legacyToPattern', () => {
  it('converts 7-day with dayOfWeek to weekly', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 7, dayOfWeek: 'Wed' }))
    expect(pattern).toEqual({ type: 'weekly', days: ['wed'] })
  })

  it('converts 14-day with dayOfWeek to biweekly', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 14, dayOfWeek: 'Mon' }))
    expect(pattern).toEqual({ type: 'biweekly', day: 'mon' })
  })

  it('converts arbitrary N-days to every_n_days', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 3, dayOfWeek: '' }))
    expect(pattern).toEqual({ type: 'every_n_days', interval: 3 })
  })

  it('falls back to every_n_days when dayOfWeek is empty (7-day)', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 7, dayOfWeek: '' }))
    expect(pattern.type).toBe('every_n_days')
  })
})
