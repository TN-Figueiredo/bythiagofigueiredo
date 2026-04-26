import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('../../lib/request-ip', () => ({
  getClientIp: vi.fn(() => '1.2.3.4'),
  isValidInet: vi.fn(() => true),
}))

vi.mock('@sentry/nextjs', () => ({
  getClient: () => undefined,
}))

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'x-forwarded-for') return '1.2.3.4'
        if (key === 'user-agent') return 'test-agent'
        return null
      },
    }),
}))

import { getSupabaseServiceClient } from '../../lib/supabase/service'
import { verifyTurnstileToken } from '../../lib/turnstile'
import { submitAdInquiry } from '../../src/app/(public)/anuncie/actions'

let insertResult = { error: null as unknown }
let rateCountResult = { count: 0 as number | null }

function buildSupabaseMock() {
  const selectEq = vi.fn().mockReturnThis()
  const selectGte = vi.fn(() => Promise.resolve(rateCountResult))

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: selectEq,
        gte: selectGte,
      })),
      insert: vi.fn(() => Promise.resolve(insertResult)),
    })),
  }
}

function makeFormData(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    name: 'Maria Silva',
    email: 'maria@example.com',
    message: 'I want to advertise on your blog about tech topics.',
    turnstile_token: 'valid-token',
  }
  const merged = { ...defaults, ...overrides }
  const fd = new FormData()
  for (const [k, v] of Object.entries(merged)) {
    fd.set(k, v)
  }
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  insertResult = { error: null }
  rateCountResult = { count: 0 }
  vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabaseMock() as never)
  vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
})

describe('submitAdInquiry', () => {
  it('returns ok on successful submission', async () => {
    const result = await submitAdInquiry(makeFormData())
    expect(result.status).toBe('ok')
  })

  it('returns validation on invalid name (too short)', async () => {
    const result = await submitAdInquiry(makeFormData({ name: 'A' }))
    expect(result.status).toBe('validation')
  })

  it('returns validation on invalid message (too short)', async () => {
    const result = await submitAdInquiry(makeFormData({ message: 'short' }))
    expect(result.status).toBe('validation')
  })

  it('returns captcha_failed when turnstile fails', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)
    const result = await submitAdInquiry(makeFormData())
    expect(result.status).toBe('captcha_failed')
  })

  it('returns rate_limited when IP exceeds 3 per hour', async () => {
    rateCountResult = { count: 3 }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabaseMock() as never)
    const result = await submitAdInquiry(makeFormData())
    expect(result.status).toBe('rate_limited')
  })

  it('returns error on DB insert failure', async () => {
    insertResult = { error: { message: 'constraint violation' } }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabaseMock() as never)
    const result = await submitAdInquiry(makeFormData())
    expect(result.status).toBe('error')
  })

  it('validates email format', async () => {
    const result = await submitAdInquiry(makeFormData({ email: 'not-an-email' }))
    expect(result.status).toBe('validation')
  })

  it('accepts optional company and website', async () => {
    const result = await submitAdInquiry(
      makeFormData({ company: 'ACME Corp', website: 'https://acme.com' }),
    )
    expect(result.status).toBe('ok')
  })

  it('accepts all valid budget values', async () => {
    for (const budget of ['under_500', '500_2000', '2000_5000', 'above_5000', 'not_sure']) {
      const result = await submitAdInquiry(makeFormData({ budget }))
      expect(result.status).toBe('ok')
    }
  })

  it('returns validation when turnstile_token is empty', async () => {
    const result = await submitAdInquiry(makeFormData({ turnstile_token: '' }))
    expect(result.status).toBe('validation')
  })
})
