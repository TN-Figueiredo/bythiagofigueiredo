import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdate } = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
  return { mockUpdate }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: Function) => fn),
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
      update: mockUpdate,
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
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/email/service', () => ({
  getEmailService: vi.fn().mockReturnValue({}),
}))

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html></html>'),
}))

vi.mock('@/emails/newsletter', () => ({
  Newsletter: vi.fn(),
}))

vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateNewsletterTypeSeo: vi.fn(),
}))

vi.mock('@/lib/newsletter/cadence-slots', () => ({
  generateCadenceSlots: vi.fn().mockReturnValue([{ date: '2026-05-10' }]),
  describePattern: vi.fn().mockReturnValue('every week'),
  computeScheduledAt: vi.fn().mockReturnValue('2026-05-10T09:00:00Z'),
}))

import { updateCadence, updateSendTime } from '@/app/cms/(authed)/newsletters/actions'

describe('updateCadence Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
  })

  it('rejects cadence_days = 0', async () => {
    const result = await updateCadence('type-1', { cadence_days: 0 })
    expect(result.ok).toBe(false)
  })

  it('rejects cadence_days = 366', async () => {
    const result = await updateCadence('type-1', { cadence_days: 366 })
    expect(result.ok).toBe(false)
  })

  it('rejects malformed time "9am"', async () => {
    const result = await updateCadence('type-1', { preferred_send_time: '9am' })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid date format', async () => {
    const result = await updateCadence('type-1', { cadence_start_date: '2026/05/01' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid HH:MM:SS time (normalized)', async () => {
    const result = await updateCadence('type-1', { preferred_send_time: '09:00:00' })
    expect(result.ok).toBe(true)
  })

  it('accepts valid patch with all fields', async () => {
    const result = await updateCadence('type-1', {
      cadence_days: 14,
      preferred_send_time: '09:00',
      cadence_start_date: '2026-05-07',
    })
    expect(result.ok).toBe(true)
  })
})

describe('updateSendTime Zod validation', () => {
  it('rejects non-HH:MM format', async () => {
    const result = await updateSendTime('type-1', 'not-a-time')
    expect(result.ok).toBe(false)
  })

  it('accepts valid HH:MM', async () => {
    const result = await updateSendTime('type-1', '14:30')
    expect(result.ok).toBe(true)
  })

  it('accepts HH:MM:SS (defense-in-depth)', async () => {
    const result = await updateSendTime('type-1', '09:00:00')
    expect(result.ok).toBe(true)
  })
})
