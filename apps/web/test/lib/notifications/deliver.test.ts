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
  let capturedStatusIn: unknown[] | null = null
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: (col: string, vals: unknown[]) => {
      if (col === 'status') capturedStatusIn = vals
      return chain
    },
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
    get _capturedStatusIn() {
      return capturedStatusIn
    },
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

  // Importante 4 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md):
  // the select used to filter status='pending' only, so a row the previous
  // run marked 'failed' (with a future next_retry_at for backoff) was NEVER
  // re-selected — attempts never reached MAX_ATTEMPTS, the row never became
  // 'dead'. The retry existed on paper and never actually ran. This test
  // would fail if that regressed: it asserts the select reaches BOTH
  // 'pending' and 'failed' rows (but not 'dead' or 'sent' — those are
  // terminal).
  it('reseleciona entregas failed (nao so pending) para o retry funcionar de verdade', async () => {
    sendMock.mockResolvedValue({ success: true })
    const supabase = makeSupabase([{ id: 'd4', channel: 'email', attempts: 1, notifications: { user_id: 'u1' } }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await processDeliveryQueue()
    expect(supabase._capturedStatusIn).toEqual(expect.arrayContaining(['pending', 'failed']))
    expect(supabase._capturedStatusIn).not.toContain('dead')
    expect(supabase._capturedStatusIn).not.toContain('sent')
  })

  it('expoe failed/dead no retorno — nao apenas processed/total', async () => {
    sendMock.mockResolvedValue({ success: false, error: 'SES throttled' })
    const supabase = makeSupabase([
      { id: 'd5', channel: 'email', attempts: 0, notifications: { user_id: 'u1' } },
      { id: 'd6', channel: 'email', attempts: 4, notifications: { user_id: 'u1' } }, // 4 -> 5 = MAX_ATTEMPTS -> dead
    ])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const result = await processDeliveryQueue()
    expect(result.processed).toBe(0)
    expect(result.total).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.dead).toBe(1)
  })
})
