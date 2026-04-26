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

  it('maps DB row to AdSlotCreative with correct field transformations', async () => {
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
          format: 'image',
          priority: 50,
          status: 'active',
          schedule_start: null,
          schedule_end: null,
          target_categories: ['tech'],
          impressions_target: 1000,
          impressions_delivered: 200,
          budget_cents: 5000,
          spent_cents: 1200,
          pacing_strategy: 'even',
          variant_group: null,
          variant_weight: 50,
          created_at: '2026-04-25T00:00:00Z',
          updated_at: '2026-04-25T00:00:00Z',
        },
      }],
      error: null,
    })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const creatives = await repo.getActiveBySlot('article_top', 'bythiagofigueiredo')

    expect(creatives).toHaveLength(1)
    const c = creatives[0]!
    expect(c.campaignId).toBe('camp-1')
    expect(c.slotKey).toBe('article_top')
    expect(c.type).toBe('cpa')
    expect(c.title).toBe('Anuncie aqui')
    expect(c.dismissSeconds).toBe(10)
    expect(c.priority).toBe(50)
    expect(c.imageUrl).toBe('https://img.example.com/ad.png')
    expect(c.targetCategories).toEqual(['tech'])
    expect(c.impressionsTarget).toBe(1000)
    expect(c.impressionsDelivered).toBe(200)
    expect(c.budgetCents).toBe(5000)
    expect(c.spentCents).toBe(1200)
    expect(c.pacingStrategy).toBe('even')
    expect(c.scheduleStart).toBeNull()
    expect(c.scheduleEnd).toBeNull()
  })

  it('maps house format to house type', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({
      data: [{
        id: 'cr-house',
        slot_key: 'article_top',
        title: 'House Ad',
        body: '',
        cta_text: 'Read more',
        cta_url: '/blog',
        image_url: null,
        dismiss_seconds: 0,
        campaign_id: 'camp-house',
        created_at: '2026-04-25T00:00:00Z',
        campaign: {
          id: 'camp-house', name: 'House', format: 'house',
          priority: 10, status: 'active',
          schedule_start: null, schedule_end: null,
          target_categories: [], impressions_target: null,
          impressions_delivered: 0, budget_cents: null, spent_cents: 0,
          pacing_strategy: 'asap', variant_group: null, variant_weight: 50,
          created_at: '2026-04-25T00:00:00Z', updated_at: '2026-04-25T00:00:00Z',
        },
      }],
      error: null,
    })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const creatives = await repo.getActiveBySlot('article_top', '')
    expect(creatives[0]!.type).toBe('house')
  })

  it('returns empty array when no rows', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({ data: [], error: null })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    const creatives = await repo.getActiveBySlot('sidebar_right', 'bythiagofigueiredo')

    expect(creatives).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const { client, chain } = buildMockClient()
    chain.order.mockResolvedValue({ data: null, error: { message: 'connection timeout' } })

    const repo = new SupabaseAdConfigRepository(client as any, 'bythiagofigueiredo')
    await expect(repo.getActiveBySlot('article_top', 'bythiagofigueiredo')).rejects.toMatchObject({
      message: 'connection timeout',
    })
  })
})
