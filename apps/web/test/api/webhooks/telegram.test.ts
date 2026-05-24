// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSendConfirmation, mockCaptureException } = vi.hoisted(() => ({
  mockSendConfirmation: vi.fn().mockResolvedValue(undefined),
  mockCaptureException: vi.fn(),
}))

const mockUpdate = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({ eq: mockEq }),
    })),
  }),
}))

vi.mock('@/lib/social/notifications/telegram', () => ({
  sendTelegramConfirmation: mockSendConfirmation,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

import { POST } from '../../../src/app/api/webhooks/telegram/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '11111111-2222-3333-4444-555555555555'
const WEBHOOK_SECRET = 'test-telegram-secret'

function telegramRequest(update: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/webhooks/telegram', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
    },
    body: JSON.stringify(update),
  })
}

function startCommand(uuid: string = VALID_UUID): Request {
  return telegramRequest({
    message: {
      from: { id: 123 },
      chat: { id: 987654, type: 'private' },
      text: `/start ${uuid}`,
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  it('returns ok:true and ignores messages without /start', async () => {
    const res = await POST(
      telegramRequest({
        message: {
          from: { id: 1 },
          chat: { id: 1, type: 'private' },
          text: 'Hello bot',
        },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns ok:true and ignores /start without a valid UUID', async () => {
    const res = await POST(
      telegramRequest({
        message: {
          from: { id: 1 },
          chat: { id: 1, type: 'private' },
          text: '/start not-a-uuid',
        },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('saves chat_id and sends confirmation on valid /start <uuid>', async () => {
    const res = await POST(startCommand())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ telegram_chat_id: '987654' }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', VALID_UUID)
    expect(mockSendConfirmation).toHaveBeenCalledWith('987654')
  })

  it('returns 500 and reports to Sentry when DB update fails', async () => {
    mockEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error', code: '42501' },
    })
    const res = await POST(startCommand())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(mockCaptureException).toHaveBeenCalled()
    expect(mockSendConfirmation).not.toHaveBeenCalled()
  })

  it('returns 500 and reports to Sentry on invalid JSON body', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
        },
        body: 'invalid-json',
      }),
    )
    expect(res.status).toBe(500)
    expect(mockCaptureException).toHaveBeenCalled()
  })
})
