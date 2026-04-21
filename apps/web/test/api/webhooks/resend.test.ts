import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.RESEND_WEBHOOK_SECRET = 'whsec_test123'

const eqMock = vi.fn().mockReturnValue({ data: null, error: null })
const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
const insertResult = Promise.resolve({ data: null, error: null })
const insertMock = vi.fn().mockReturnValue(insertResult)
const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
const selectEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock })

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'webhook_events') return { select: selectMock, insert: insertMock }
      if (table === 'newsletter_sends') return { update: updateMock, select: selectMock }
      if (table === 'newsletter_editions') return { update: updateMock }
      return { select: selectMock, update: updateMock, insert: insertMock }
    }),
  }),
}))

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'msg_123', created_at: '2026-04-20T10:00:00Z' },
    }),
  })),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/webhooks/resend/route'

function req(body: unknown = {}) {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'svix_123',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,test',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 on valid webhook', async () => {
    const res = await POST(req({ type: 'email.delivered', data: { email_id: 'msg_123' } }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when RESEND_WEBHOOK_SECRET is not set', async () => {
    const saved = process.env.RESEND_WEBHOOK_SECRET
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = await POST(req())
    process.env.RESEND_WEBHOOK_SECRET = saved
    expect(res.status).toBe(400)
  })
})
