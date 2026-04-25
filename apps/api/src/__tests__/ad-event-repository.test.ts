import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseAdEventRepository } from '../infrastructure/repositories/supabase-ad-event-repository.js'

interface MockChain {
  insert: ReturnType<typeof vi.fn>
}

function buildMockClient() {
  const chain: MockChain = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  }
  const client = { from: vi.fn().mockReturnValue(chain) }
  return { client, chain }
}

beforeEach(() => vi.clearAllMocks())

describe('SupabaseAdEventRepository', () => {
  it('inserts event including ad_id when provided', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any)

    await repo.insert({
      adId: 'ad-uuid-1',
      eventType: 'impression',
      userHash: 'abc123',
      appId: 'bythiagofigueiredo',
      slotId: 'article_top',
    })

    expect(client.from).toHaveBeenCalledWith('ad_events')
    expect(chain.insert).toHaveBeenCalledWith({
      ad_id: 'ad-uuid-1',
      event_type: 'impression',
      user_hash: 'abc123',
      app_id: 'bythiagofigueiredo',
      slot_id: 'article_top',
    })
  })

  it('omits ad_id field when adId is null', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any)

    await repo.insert({
      adId: null,
      eventType: 'click',
      userHash: 'def456',
      appId: 'bythiagofigueiredo',
      slotId: 'sidebar_right',
    })

    const arg = chain.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).not.toHaveProperty('ad_id')
    expect(arg).toMatchObject({
      event_type: 'click',
      user_hash: 'def456',
      app_id: 'bythiagofigueiredo',
      slot_id: 'sidebar_right',
    })
  })

  it('throws when Supabase returns an error', async () => {
    const { client, chain } = buildMockClient()
    chain.insert.mockResolvedValue({ error: { message: 'insert failed' } })
    const repo = new SupabaseAdEventRepository(client as any)

    await expect(
      repo.insert({ adId: null, eventType: 'dismiss', userHash: 'x', appId: 'btf', slotId: 'below_fold' }),
    ).rejects.toMatchObject({ message: 'insert failed' })
  })

  it('handles all four event types', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any)

    for (const eventType of ['impression', 'click', 'dismiss', 'interest'] as const) {
      chain.insert.mockResolvedValue({ error: null })
      await repo.insert({ adId: null, eventType, userHash: 'u', appId: 'btf', slotId: 'article_top' })
      const lastCall = chain.insert.mock.calls.at(-1)
      const arg = lastCall![0] as Record<string, unknown>
      expect(arg.event_type).toBe(eventType)
    }
  })
})
