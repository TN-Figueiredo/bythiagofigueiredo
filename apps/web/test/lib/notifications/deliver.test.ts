import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('../../../src/lib/notifications/adapters', () => ({
  EmailAdapter: vi.fn().mockImplementation(() => ({ channel: 'email', send: sendMock })),
  PushAdapter: vi.fn().mockImplementation(() => ({ channel: 'push', send: vi.fn() })),
  TelegramAdapter: vi.fn().mockImplementation(() => ({ channel: 'telegram', send: vi.fn() })),
}))

import { processDeliveryQueue } from '../../../src/lib/notifications/cron/deliver'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function makeSupabase(pending: Record<string, unknown>[]) {
  const updates: Record<string, unknown>[] = []
  const chain = {
    select: () => chain,
    eq: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: pending, error: null }),
    update: (payload: Record<string, unknown>) => ({
      eq: (_c: string, val: unknown) => {
        updates.push({ ...payload, id: val })
        return Promise.resolve({ error: null })
      },
    }),
  }
  return {
    from: () => chain,
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'u@x.com' } } }) } },
    _updates: updates,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('processDeliveryQueue', () => {
  it('adapter que falha grava failed + last_error', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'SES throttled' })
    const supabase = makeSupabase([{ id: 'd1', channel: 'email', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await processDeliveryQueue()
    expect(supabase._updates[0]).toMatchObject({ status: 'failed', last_error: 'SES throttled', id: 'd1' })
  })

  it('canal sem adapter nunca marca sent', async () => {
    const supabase = makeSupabase([{ id: 'd2', channel: 'sms', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const result = await processDeliveryQueue()
    expect(result.processed).toBe(0)
    expect(supabase._updates[0]!.status).not.toBe('sent')
  })

  it('sucesso marca sent', async () => {
    sendMock.mockResolvedValue({ success: true })
    const supabase = makeSupabase([{ id: 'd3', channel: 'email', attempts: 0, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const result = await processDeliveryQueue()
    expect(result.processed).toBe(1)
    expect(supabase._updates[0]!.status).toBe('sent')
  })
})
