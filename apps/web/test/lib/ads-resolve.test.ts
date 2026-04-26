import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapResolutionToCreativeData } from '../../src/lib/ads/resolve'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
}))

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { enabled: true } }),
}

const mockFrom = vi.fn().mockReturnValue(mockChain)

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    type: 'house',
    status: 'active',
    brand_color: '#000',
    logo_url: null,
    priority: 10,
    schedule_start: null,
    schedule_end: null,
    ...overrides,
  }
}

function makeRow(slot_key: string, campaign: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    slot_key,
    title: `Title ${slot_key}`,
    body: 'Body',
    cta_text: 'CTA',
    cta_url: '/go',
    image_url: null,
    dismiss_seconds: 0,
    locale: 'en',
    interaction: 'link',
    campaign,
    ...overrides,
  }
}

describe('loadAdCreatives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function loadFresh() {
    vi.resetModules()
    const mod = await import('../../src/lib/ads/resolve')
    return mod.loadAdCreatives
  }

  function setupCalls(options: {
    masterEnabled?: boolean
    killSlots?: { id: string; enabled: boolean }[]
    creatives?: ReturnType<typeof makeRow>[]
    placeholders?: Record<string, unknown>[]
  }) {
    const {
      masterEnabled = true,
      killSlots = [],
      creatives = [],
      placeholders = [],
    } = options

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'kill_switches') {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { enabled: masterEnabled } }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockResolvedValue({ data: killSlots }),
          }),
        }
      }
      if (table === 'ad_slot_creatives') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: creatives }),
          }),
        }
      }
      if (table === 'ad_placeholders') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: placeholders }),
            }),
          }),
        }
      }
      return mockChain
    })
  }

  it('returns empty when master kill switch is disabled', async () => {
    setupCalls({ masterEnabled: false })
    const load = await loadFresh()
    const result = await load('en')
    expect(result).toEqual({})
  })

  it('maps campaign creative to AdCreativeData', async () => {
    const campaign = makeCampaign({ id: 'camp-1', type: 'cpa', brand_color: '#FF0000', logo_url: '/logo.svg' })
    setupCalls({
      creatives: [makeRow('banner_top', campaign, { interaction: 'form' })],
    })
    const load = await loadFresh()
    const result = await load('en')

    expect(result.banner_top).toBeDefined()
    expect(result.banner_top!.campaignId).toBe('camp-1')
    expect(result.banner_top!.type).toBe('cpa')
    expect(result.banner_top!.source).toBe('campaign')
    expect(result.banner_top!.interaction).toBe('form')
    expect(result.banner_top!.brandColor).toBe('#FF0000')
    expect(result.banner_top!.logoUrl).toBe('/logo.svg')
  })

  it('highest priority campaign wins per slot', async () => {
    const low = makeCampaign({ id: 'low', priority: 1 })
    const high = makeCampaign({ id: 'high', priority: 99 })
    setupCalls({
      creatives: [
        makeRow('banner_top', low, { title: 'Low' }),
        makeRow('banner_top', high, { title: 'High' }),
      ],
    })
    const load = await loadFresh()
    const result = await load('en')

    expect(result.banner_top!.campaignId).toBe('high')
    expect(result.banner_top!.title).toBe('High')
  })

  it('filters out inactive campaigns', async () => {
    setupCalls({
      creatives: [makeRow('banner_top', makeCampaign({ status: 'draft' }))],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.banner_top).toBeUndefined()
  })

  it('filters out campaigns not yet started', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString()
    setupCalls({
      creatives: [makeRow('banner_top', makeCampaign({ schedule_start: future }))],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.banner_top).toBeUndefined()
  })

  it('filters out expired campaigns', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString()
    setupCalls({
      creatives: [makeRow('banner_top', makeCampaign({ schedule_end: past }))],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.banner_top).toBeUndefined()
  })

  it('respects per-slot kill switches', async () => {
    setupCalls({
      killSlots: [{ id: 'ads_slot_banner_top', enabled: false }],
      creatives: [makeRow('banner_top', makeCampaign())],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.banner_top).toBeUndefined()
  })

  it('fills unfilled slots from placeholders', async () => {
    setupCalls({
      creatives: [],
      placeholders: [
        {
          slot_id: 'inline_mid',
          headline: 'PH Title',
          body: 'PH Body',
          cta_text: 'Go',
          cta_url: '/ph',
          image_url: null,
          dismiss_after_ms: 5000,
          is_enabled: true,
        },
      ],
    })
    const load = await loadFresh()
    const result = await load('en')

    expect(result.inline_mid).toBeDefined()
    expect(result.inline_mid!.source).toBe('placeholder')
    expect(result.inline_mid!.campaignId).toBeNull()
    expect(result.inline_mid!.title).toBe('PH Title')
    expect(result.inline_mid!.dismissSeconds).toBe(5)
  })

  it('does not query placeholders for killed slots', async () => {
    setupCalls({
      killSlots: [{ id: 'ads_slot_inline_mid', enabled: false }],
      creatives: [],
      placeholders: [
        { slot_id: 'inline_mid', headline: 'X', body: '', cta_text: '', cta_url: '', image_url: null, dismiss_after_ms: 0, is_enabled: true },
      ],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.inline_mid).toBeUndefined()
  })

  it('does not include inline_end slot (removed in 1.0.0)', async () => {
    setupCalls({
      creatives: [makeRow('inline_end', makeCampaign())],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.inline_end).toBeUndefined()
  })

  it('returns non-empty when master kill switch is enabled', async () => {
    const campaign = makeCampaign()
    setupCalls({
      masterEnabled: true,
      creatives: [makeRow('banner_top', campaign)],
    })
    const load = await loadFresh()
    const result = await load('en')
    expect(result.banner_top).toBeDefined()
  })
})

describe('mapResolutionToCreativeData', () => {
  const fullCreative = {
    campaign_id: 'camp-42',
    type: 'cpa',
    interaction: 'form',
    title: 'Ad Title',
    body: 'Ad Body',
    cta_text: 'Click Here',
    cta_url: 'https://example.com',
    image_url: 'https://img.example.com/ad.png',
    dismiss_seconds: 10,
    logo_url: 'https://img.example.com/logo.svg',
    brand_color: '#FF5500',
  }

  it('returns null when resolution.source is "empty"', () => {
    const result = mapResolutionToCreativeData('banner_top', {
      source: 'empty',
      creative: fullCreative,
    })
    expect(result).toBeNull()
  })

  it('returns null when resolution.creative is null', () => {
    const result = mapResolutionToCreativeData('banner_top', {
      source: 'campaign',
      creative: null,
    })
    expect(result).toBeNull()
  })

  it('returns null when resolution.creative is undefined', () => {
    const result = mapResolutionToCreativeData('banner_top', {
      source: 'campaign',
    })
    expect(result).toBeNull()
  })

  it('returns correct AdCreativeData shape when creative exists', () => {
    const result = mapResolutionToCreativeData('rail_left', {
      source: 'campaign',
      creative: fullCreative,
    })

    expect(result).not.toBeNull()
    expect(result).toEqual({
      campaignId: 'camp-42',
      slotKey: 'rail_left',
      type: 'cpa',
      source: 'campaign',
      interaction: 'form',
      title: 'Ad Title',
      body: 'Ad Body',
      ctaText: 'Click Here',
      ctaUrl: 'https://example.com',
      imageUrl: 'https://img.example.com/ad.png',
      logoUrl: 'https://img.example.com/logo.svg',
      brandColor: '#FF5500',
      dismissSeconds: 10,
    })
  })

  it('maps all fields correctly including slotKey from argument', () => {
    const result = mapResolutionToCreativeData('inline_mid', {
      source: 'placeholder',
      creative: fullCreative,
    })!

    expect(result.campaignId).toBe('camp-42')
    expect(result.slotKey).toBe('inline_mid')
    expect(result.type).toBe('cpa')
    expect(result.source).toBe('placeholder')
    expect(result.interaction).toBe('form')
    expect(result.title).toBe('Ad Title')
    expect(result.body).toBe('Ad Body')
    expect(result.ctaText).toBe('Click Here')
    expect(result.ctaUrl).toBe('https://example.com')
    expect(result.imageUrl).toBe('https://img.example.com/ad.png')
    expect(result.logoUrl).toBe('https://img.example.com/logo.svg')
    expect(result.brandColor).toBe('#FF5500')
    expect(result.dismissSeconds).toBe(10)
  })

  it('applies defaults for nullable fields when creative has nulls', () => {
    const result = mapResolutionToCreativeData('block_bottom', {
      source: 'campaign',
      creative: {
        campaign_id: null,
        type: 'house',
        interaction: null,
        title: null,
        body: null,
        cta_text: null,
        cta_url: null,
        image_url: null,
        dismiss_seconds: null,
        logo_url: null,
        brand_color: null,
      },
    })!

    expect(result.campaignId).toBeNull()
    expect(result.type).toBe('house')
    expect(result.interaction).toBe('link')
    expect(result.title).toBe('')
    expect(result.body).toBe('')
    expect(result.ctaText).toBe('')
    expect(result.ctaUrl).toBe('')
    expect(result.imageUrl).toBeNull()
    expect(result.logoUrl).toBeNull()
    expect(result.brandColor).toBe('#6B7280')
    expect(result.dismissSeconds).toBe(0)
  })
})
