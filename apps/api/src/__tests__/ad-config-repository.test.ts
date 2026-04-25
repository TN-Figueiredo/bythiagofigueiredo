import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseAdConfigRepository } from '../infrastructure/repositories/supabase-ad-config-repository.js'

interface MockChain {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

function buildMockClient() {
  const chain: MockChain = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  const client = { from: vi.fn().mockReturnValue(chain) }
  return { client, chain }
}

beforeEach(() => vi.clearAllMocks())

describe('SupabaseAdConfigRepository', () => {
  it('queries ad_slot_creatives with JOIN on ad_campaigns', async () => {
    const { client, chain } = buildMockClient()
    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')

    await repo.getActiveBySlot('article_top', 'bythiagofigueiredo')

    expect(client.from).toHaveBeenCalledWith('ad_slot_creatives')
    expect(chain.eq).toHaveBeenCalledWith('slot_key', 'article_top')
    expect(chain.eq).toHaveBeenCalledWith('campaign.status', 'active')
  })

  it('maps DB row to AdConfig with correct field transformations', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({
      data: [{
        id: 'creative-1',
        slot_key: 'article_top',
        title: 'Anuncie aqui',
        body: 'Alcance nossos leitores',
        cta_text: 'Saiba mais',
        cta_url: 'https://example.com/ads',
        image_url: 'https://img.example.com/ad.png',
        dismiss_seconds: 10,
        campaign_id: 'camp-1',
        created_at: '2026-04-25T00:00:00Z',
        campaign: {
          id: 'camp-1',
          name: 'Campanha Teste',
          type: null,
          format: 'image',
          priority: 50,
          status: 'active',
          audience: ['general'],
          schedule_start: null,
          schedule_end: null,
          created_at: '2026-04-25T00:00:00Z',
          updated_at: '2026-04-25T00:00:00Z',
        },
      }],
      error: null,
    })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const configs = await repo.getActiveBySlot('article_top', 'bythiagofigueiredo')

    expect(configs).toHaveLength(1)
    // configs[0] is guaranteed by the assertion above; use non-null assertion for noUncheckedIndexedAccess
    const c = configs[0]!
    expect(c.id).toBe('camp-1')
    expect(c.slotId).toBe('article_top')
    expect(c.appId).toBe('bythiagofigueiredo')
    expect(c.format).toBe('banner')       // 'image' → 'banner'
    expect(c.dismissAfterMs).toBe(10_000) // 10s → 10000ms
    expect(c.priority).toBe(50)
    expect(c.creative).toMatchObject({
      title: 'Anuncie aqui',
      ctaText: 'Saiba mais',
      ctaUrl: 'https://example.com/ads',
    })
    expect(c.active).toBe(true)
    expect(c.startsAt).toBeNull()
    expect(c.endsAt).toBeNull()
  })

  it('returns empty array when no rows', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({ data: [], error: null })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const configs = await repo.getActiveBySlot('sidebar_right', 'bythiagofigueiredo')

    expect(configs).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({ data: null, error: { message: 'connection timeout' } })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    await expect(repo.getActiveBySlot('article_top', 'bythiagofigueiredo')).rejects.toMatchObject({
      message: 'connection timeout',
    })
  })

  it('falls back to constructor appId when query appId is empty string', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({
      data: [{
        id: 'cr-2',
        slot_key: 'below_fold',
        title: 'Ad',
        body: null,
        cta_text: 'Click',
        cta_url: 'https://x.com',
        image_url: null,
        dismiss_seconds: 0,
        campaign_id: 'camp-2',
        created_at: '2026-04-25T00:00:00Z',
        campaign: {
          id: 'camp-2', name: 'Below Fold', type: null, format: 'native',
          priority: 10, status: 'active', audience: [],
          schedule_start: null, schedule_end: null,
          created_at: '2026-04-25T00:00:00Z', updated_at: '2026-04-25T00:00:00Z',
        },
      }],
      error: null,
    })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const configs = await repo.getActiveBySlot('below_fold', '') // empty → falls back

    expect(configs[0]!.appId).toBe('bythiagofigueiredo')
  })
})
