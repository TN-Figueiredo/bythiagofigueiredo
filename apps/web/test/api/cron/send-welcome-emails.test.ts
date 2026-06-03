import { describe, it, expect, vi, beforeEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET
process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'

const fromMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

vi.mock('../../../lib/newsletter/welcome-email', () => ({
  sendWelcomeEmail: vi.fn(),
}))

vi.mock('../../../src/lib/env', () => ({
  getServerEnv: () => ({ CRON_SECRET: 'test-secret' }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/send-welcome-emails/route'
import { sendWelcomeEmail } from '../../../lib/newsletter/welcome-email'

const sendWelcomeEmailMock = vi.mocked(sendWelcomeEmail)

function req(secret?: string) {
  return new Request('http://localhost/api/cron/send-welcome-emails', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/send-welcome-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('returns 401 with wrong secret', async () => {
    const res = await POST(req('wrong-secret'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('returns 200 with sent: 0 when no pending subscribers', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', sent: 0 })
  })

  it('sends welcome email and marks subscription as sent', async () => {
    const subscriber = {
      id: 'sub-1',
      email: 'user@example.com',
      locale: 'pt-BR',
      site_id: 'site-1',
      newsletter_id: 'nl-1',
    }

    sendWelcomeEmailMock.mockResolvedValue(true)

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [subscriber], error: null }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      }
      if (table === 'newsletter_types') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ name: 'Weekly', tagline: 'Weekly picks', color: '#FF8240', cadence_label: null, cadence_days: 7, cadence_start_date: '2026-05-16', locale: 'en' }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'unsubscribe_tokens') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {}
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', sent: 1 })

    expect(sendWelcomeEmailMock).toHaveBeenCalledOnce()
    const callArgs = sendWelcomeEmailMock.mock.calls[0]![0]
    expect(callArgs.to).toBe('user@example.com')
    expect(callArgs.locale).toBe('pt-BR')
    expect(callArgs.newsletterNames).toHaveLength(1)
    expect(callArgs.newsletterNames[0].name).toBe('Weekly')
    expect(callArgs.unsubscribeUrl).toMatch(/^https:\/\/bythiagofigueiredo\.com\/api\/newsletters\/unsubscribe\?token=/)
  })
})
