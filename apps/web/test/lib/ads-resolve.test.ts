import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdResolution, AdSlotCreative, AdPlaceholder, AdSlotDefinition } from '@tn-figueiredo/ad-engine'

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

const resolveSlotMock = vi.fn()
vi.mock('@tn-figueiredo/ad-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tn-figueiredo/ad-engine')>()
  return {
    ...actual,
    resolveSlot: (...args: unknown[]) => resolveSlotMock(...args),
  }
})

function makeDummySlot(): AdSlotDefinition {
  return {
    key: 'banner_top',
    label: 'Banner',
    desc: '',
    badge: '',
    badgeColor: '',
    zone: 'banner',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '8:1',
    iabSize: '728x90',
  }
}

function makeCreative(overrides: Partial<AdSlotCreative> = {}): AdSlotCreative {
  return {
    campaignId: 'camp-1',
    slotKey: 'banner_top',
    type: 'house',
    title: 'Title',
    body: 'Body',
    ctaText: 'CTA',
    ctaUrl: '/go',
    imageUrl: null,
    logoUrl: null,
    brandColor: '#000',
    interaction: 'link',
    dismissSeconds: 0,
    priority: 10,
    targetCategories: [],
    scheduleStart: null,
    scheduleEnd: null,
    impressionsTarget: null,
    impressionsDelivered: 0,
    budgetCents: null,
    spentCents: 0,
    pacingStrategy: 'even',
    variantGroup: null,
    variantWeight: 100,
    ...overrides,
  }
}

function makeEmptyResolution(slotKey: string): AdResolution {
  return {
    source: 'empty',
    slot: { ...makeDummySlot(), key: slotKey },
    cached: false,
  }
}

function makeCampaignResolution(slotKey: string, creative: AdSlotCreative): AdResolution {
  return {
    source: creative.type,
    creative,
    slot: { ...makeDummySlot(), key: slotKey },
    cached: false,
  }
}

function makePlaceholderResolution(slotKey: string, placeholder: AdPlaceholder): AdResolution {
  return {
    source: 'template',
    placeholder,
    slot: { ...makeDummySlot(), key: slotKey },
    cached: false,
  }
}

function makeCampaignRow(slot_key: string, overrides: Record<string, unknown> = {}) {
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
    target_categories: null,
    impressions_target: null,
    impressions_delivered: 0,
    budget_cents: null,
    spent_cents: 0,
    pacing_strategy: 'even',
    variant_group: null,
    variant_weight: 100,
    campaign: {
      id: 'c1',
      type: 'house',
      status: 'active',
      brand_color: '#000',
      logo_url: null,
      priority: 10,
      schedule_start: null,
      schedule_end: null,
    },
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
    siteId?: string | null
    slotConfigs?: Record<string, unknown>[]
    killSlots?: { id: string; enabled: boolean }[]
    creatives?: ReturnType<typeof makeCampaignRow>[]
    placeholders?: Record<string, unknown>[]
  }) {
    const {
      masterEnabled = true,
      siteId = 'site-uuid-1',
      slotConfigs = [],
      killSlots = [],
      creatives = [],
      placeholders = [],
    } = options

    mockFrom.mockImplementation((table: string) => {
      if (table === 'kill_switches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              if (val === 'kill_ads') {
                return {
                  single: vi.fn().mockResolvedValue({ data: { enabled: masterEnabled } }),
                }
              }
              // Should not happen for the first kill_switches call
              return {
                single: vi.fn().mockResolvedValue({ data: null }),
              }
            }),
            like: vi.fn().mockResolvedValue({ data: killSlots }),
          }),
        }
      }
      if (table === 'sites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: siteId ? { id: siteId } : null,
              }),
            }),
          }),
        }
      }
      if (table === 'ad_slot_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: slotConfigs }),
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
            eq: vi.fn().mockResolvedValue({ data: placeholders }),
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
    expect(resolveSlotMock).not.toHaveBeenCalled()
  })

  it('returns empty when site is not found', async () => {
    setupCalls({ siteId: null })
    const load = await loadFresh()
    const result = await load('en')
    expect(result).toEqual({})
    expect(resolveSlotMock).not.toHaveBeenCalled()
  })

  it('calls resolveSlot for each slot key', async () => {
    setupCalls({ creatives: [] })
    resolveSlotMock.mockReturnValue({ source: 'empty', slot: makeDummySlot(), cached: false })
    const load = await loadFresh()
    await load('en')
    expect(resolveSlotMock).toHaveBeenCalledTimes(5)
  })

  it('maps campaign creative from resolveSlot result', async () => {
    const creative = makeCreative({
      campaignId: 'camp-1',
      slotKey: 'banner_top',
      type: 'cpa',
      brandColor: '#FF0000',
      logoUrl: '/logo.svg',
      interaction: 'form',
    })
    setupCalls({
      creatives: [makeCampaignRow('banner_top', {
        campaign: {
          id: 'camp-1',
          type: 'cpa',
          status: 'active',
          brand_color: '#FF0000',
          logo_url: '/logo.svg',
          priority: 10,
          schedule_start: null,
          schedule_end: null,
        },
        interaction: 'form',
      })],
    })
    resolveSlotMock.mockImplementation((config: { key: string }) => {
      if (config.key === 'banner_top') {
        return makeCampaignResolution('banner_top', creative)
      }
      return makeEmptyResolution(config.key)
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

  it('maps placeholder from resolveSlot result', async () => {
    const placeholder: AdPlaceholder = {
      slotId: 'inline_mid',
      headline: 'PH Title',
      body: 'PH Body',
      ctaText: 'Go',
      ctaUrl: '/ph',
      imageUrl: null,
      isEnabled: true,
    }
    setupCalls({
      placeholders: [
        { slot_id: 'inline_mid', headline: 'PH Title', body: 'PH Body', cta_text: 'Go', cta_url: '/ph', image_url: null, is_enabled: true },
      ],
    })
    resolveSlotMock.mockImplementation((config: { key: string }) => {
      if (config.key === 'inline_mid') {
        return makePlaceholderResolution('inline_mid', placeholder)
      }
      return makeEmptyResolution(config.key)
    })

    const load = await loadFresh()
    const result = await load('en')

    expect(result.inline_mid).toBeDefined()
    expect(result.inline_mid!.source).toBe('placeholder')
    expect(result.inline_mid!.campaignId).toBeNull()
    expect(result.inline_mid!.title).toBe('PH Title')
  })

  it('passes killed=true to resolveSlot for killed slots', async () => {
    setupCalls({
      killSlots: [{ id: 'ads_slot_banner_top', enabled: false }],
    })
    resolveSlotMock.mockReturnValue({ source: 'empty', slot: makeDummySlot(), cached: false })

    const load = await loadFresh()
    await load('en')

    const bannerCall = resolveSlotMock.mock.calls.find(
      (args: unknown[]) => (args[0] as { key: string }).key === 'banner_top',
    )
    expect(bannerCall).toBeDefined()
    expect((bannerCall![0] as { killed: boolean }).killed).toBe(true)
  })

  it('returns empty for slots where resolveSlot returns empty', async () => {
    setupCalls({})
    resolveSlotMock.mockReturnValue({ source: 'empty', slot: makeDummySlot(), cached: false })

    const load = await loadFresh()
    const result = await load('en')

    expect(result.banner_top).toBeUndefined()
    expect(result.rail_left).toBeUndefined()
    expect(result.inline_mid).toBeUndefined()
  })

  it('uses slot config from DB when available', async () => {
    setupCalls({
      slotConfigs: [{
        slot_key: 'banner_top',
        house_enabled: false,
        cpa_enabled: true,
        google_enabled: true,
        template_enabled: false,
        network_adapters_order: ['adsense'],
        network_config: { adsense: { pub: 'ca-123' } },
        max_per_session: 5,
        max_per_day: 10,
        cooldown_ms: 500,
      }],
    })
    resolveSlotMock.mockReturnValue({ source: 'empty', slot: makeDummySlot(), cached: false })

    const load = await loadFresh()
    await load('en')

    const bannerCall = resolveSlotMock.mock.calls.find(
      (args: unknown[]) => (args[0] as { key: string }).key === 'banner_top',
    )
    expect(bannerCall).toBeDefined()
    const config = bannerCall![0] as {
      houseEnabled: boolean
      cpaEnabled: boolean
      googleEnabled: boolean
      templateEnabled: boolean
      maxPerSession: number
    }
    expect(config.houseEnabled).toBe(false)
    expect(config.cpaEnabled).toBe(true)
    expect(config.googleEnabled).toBe(true)
    expect(config.templateEnabled).toBe(false)
    expect(config.maxPerSession).toBe(5)
  })

  it('falls back to definition defaults when no DB config', async () => {
    setupCalls({ slotConfigs: [] })
    resolveSlotMock.mockReturnValue({ source: 'empty', slot: makeDummySlot(), cached: false })

    const load = await loadFresh()
    await load('en')

    const bannerCall = resolveSlotMock.mock.calls.find(
      (args: unknown[]) => (args[0] as { key: string }).key === 'banner_top',
    )
    expect(bannerCall).toBeDefined()
    const config = bannerCall![0] as {
      houseEnabled: boolean
      cpaEnabled: boolean
      maxPerSession: number
      maxPerDay: number
      cooldownMs: number
    }
    expect(config.houseEnabled).toBe(true)
    expect(config.cpaEnabled).toBe(true)
    expect(config.maxPerSession).toBe(1)
    expect(config.maxPerDay).toBe(3)
    expect(config.cooldownMs).toBe(3_600_000)
  })
})

describe('mapResolutionToCreativeData', () => {
  // Import directly (non-dynamic) for the pure mapping function
  let mapResolutionToCreativeData: typeof import('../../src/lib/ads/resolve').mapResolutionToCreativeData

  beforeEach(async () => {
    const mod = await import('../../src/lib/ads/resolve')
    mapResolutionToCreativeData = mod.mapResolutionToCreativeData
  })

  const fullCreative = makeCreative({
    campaignId: 'camp-42',
    type: 'cpa',
    interaction: 'form',
    title: 'Ad Title',
    body: 'Ad Body',
    ctaText: 'Click Here',
    ctaUrl: 'https://example.com',
    imageUrl: 'https://img.example.com/ad.png',
    dismissSeconds: 10,
    logoUrl: 'https://img.example.com/logo.svg',
    brandColor: '#FF5500',
  })

  it('returns null when resolution.source is "empty"', () => {
    const result = mapResolutionToCreativeData('banner_top', makeEmptyResolution('banner_top'))
    expect(result).toBeNull()
  })

  it('returns null when resolution has no creative and no placeholder', () => {
    const resolution: AdResolution = {
      source: 'house',
      slot: makeDummySlot(),
      cached: false,
    }
    const result = mapResolutionToCreativeData('banner_top', resolution)
    expect(result).toBeNull()
  })

  it('returns correct AdCreativeData shape from campaign creative', () => {
    const resolution = makeCampaignResolution('rail_left', fullCreative)
    const result = mapResolutionToCreativeData('rail_left', resolution)

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
    const resolution = makeCampaignResolution('inline_mid', fullCreative)
    const result = mapResolutionToCreativeData('inline_mid', resolution)!

    expect(result.campaignId).toBe('camp-42')
    expect(result.slotKey).toBe('inline_mid')
    expect(result.type).toBe('cpa')
    expect(result.source).toBe('campaign')
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

  it('returns placeholder-sourced creative data', () => {
    const placeholder: AdPlaceholder = {
      slotId: 'block_bottom',
      headline: 'PH Headline',
      body: 'PH Body',
      ctaText: 'PH CTA',
      ctaUrl: '/placeholder',
      imageUrl: null,
      isEnabled: true,
    }
    const resolution = makePlaceholderResolution('block_bottom', placeholder)
    const result = mapResolutionToCreativeData('block_bottom', resolution)!

    expect(result.campaignId).toBeNull()
    expect(result.slotKey).toBe('block_bottom')
    expect(result.type).toBe('house')
    expect(result.source).toBe('placeholder')
    expect(result.interaction).toBe('link')
    expect(result.title).toBe('PH Headline')
    expect(result.body).toBe('PH Body')
    expect(result.ctaText).toBe('PH CTA')
    expect(result.ctaUrl).toBe('/placeholder')
    expect(result.imageUrl).toBeNull()
    expect(result.logoUrl).toBeNull()
    expect(result.brandColor).toBe('#6B7280')
    expect(result.dismissSeconds).toBe(0)
  })

  it('prefers creative over placeholder when both present', () => {
    const resolution: AdResolution = {
      source: 'house',
      creative: fullCreative,
      placeholder: {
        slotId: 'banner_top',
        headline: 'PH',
        body: 'PH',
        ctaText: 'PH',
        ctaUrl: '/ph',
        imageUrl: null,
        isEnabled: true,
      },
      slot: makeDummySlot(),
      cached: false,
    }
    const result = mapResolutionToCreativeData('banner_top', resolution)!
    expect(result.source).toBe('campaign')
    expect(result.campaignId).toBe('camp-42')
  })
})
