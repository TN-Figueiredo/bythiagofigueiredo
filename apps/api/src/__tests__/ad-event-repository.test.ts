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
  it('inserts event including ad_id when campaignId is provided', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any, 'bythiagofigueiredo')

    await repo.insert({
      campaignId: 'camp-uuid-1',
      type: 'impression',
      userHash: 'abc123',
      slotKey: 'article_top',
      timestamp: Date.now(),
    })

    expect(client.from).toHaveBeenCalledWith('ad_events')
    expect(chain.insert).toHaveBeenCalledWith({
      ad_id: 'camp-uuid-1',
      event_type: 'impression',
      user_hash: 'abc123',
      app_id: 'bythiagofigueiredo',
      slot_id: 'article_top',
    })
  })

  it('omits ad_id field when campaignId is null', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any, 'bythiagofigueiredo')

    await repo.insert({
      campaignId: null,
      type: 'click',
      userHash: 'def456',
      slotKey: 'sidebar_right',
      timestamp: Date.now(),
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
    const repo = new SupabaseAdEventRepository(client as any, 'btf')

    await expect(
      repo.insert({ campaignId: null, type: 'dismiss', userHash: 'x', slotKey: 'below_fold', timestamp: Date.now() }),
    ).rejects.toMatchObject({ message: 'insert failed' })
  })

  it('handles all three event types', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdEventRepository(client as any, 'btf')

    for (const type of ['impression', 'click', 'dismiss'] as const) {
      chain.insert.mockResolvedValue({ error: null })
      await repo.insert({ campaignId: null, type, userHash: 'u', slotKey: 'article_top', timestamp: Date.now() })
      const lastCall = chain.insert.mock.calls.at(-1)
      const arg = lastCall![0] as Record<string, unknown>
      expect(arg.event_type).toBe(type)
    }
  })
})
