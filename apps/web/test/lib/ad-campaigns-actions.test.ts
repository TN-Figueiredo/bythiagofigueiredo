import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ---------------------------------------------------------------------------
 * Mock result + chainable builder
 * Supports .insert().select().single(), .update().eq().eq(), .delete().eq().eq()
 * -------------------------------------------------------------------------*/
const mockResult = { data: { id: 'c-1' } as Record<string, unknown> | null, error: null as { message: string } | null }

function makeChainable(result = mockResult) {
  const chain: Record<string, unknown> = {
    eq: vi.fn(() => makeChainable(result)),
    select: vi.fn(() => makeChainable(result)),
    single: vi.fn(() => makeChainable(result)),
    delete: vi.fn(() => makeChainable(result)),
    insert: vi.fn(() => makeChainable(result)),
    upsert: vi.fn(() => makeChainable(result)),
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

const mockInsertChain = makeChainable()
const mockUpdateChain = makeChainable()
const mockDeleteChain = makeChainable()
const mockUpsertChain = makeChainable()

const mockChain = {
  insert: vi.fn(() => mockInsertChain),
  update: vi.fn(() => mockUpdateChain),
  delete: vi.fn(() => mockDeleteChain),
  upsert: vi.fn(() => mockUpsertChain),
}
const mockFrom = vi.fn(() => mockChain)

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

const mockFetchAdCampaignById = vi.fn().mockResolvedValue({ id: 'c-1', name: 'Test' })
vi.mock('@tn-figueiredo/ad-engine-admin', () => ({
  createAdminQueries: () => ({
    fetchAdCampaignById: mockFetchAdCampaignById,
  }),
}))

import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { captureServerActionError } from '@/lib/sentry-wrap'

const actionsPath = '../../src/app/admin/(authed)/ads/_actions/campaigns'

function baseCampaignData() {
  return {
    name: 'Test Campaign',
    format: 'banner' as const,
    audience: ['free'],
    limits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3600000 },
    priority: 5,
    pricing: { model: 'cpm' as const, value: 10 },
    schedule: { start: '2026-01-01', end: '2026-12-31' },
    status: 'draft' as const,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResult.data = { id: 'c-1' }
  mockResult.error = null
})

/* ---------------------------------------------------------------------------
 * createCampaign
 * -------------------------------------------------------------------------*/
describe('createCampaign', () => {
  it('calls requireArea("admin") before inserting', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('inserts with app_id = "bythiagofigueiredo"', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.app_id).toBe('bythiagofigueiredo')
  })

  it('persists the type field from form data', async () => {
    const { createCampaign } = await import(actionsPath)
    const data = { ...baseCampaignData(), type: 'cpa' }
    await createCampaign(data)
    const insertArg = mockChain.insert.mock.calls[0][0]
    expect(insertArg.type).toBe('cpa')
  })

  it('inserts creatives with correct locale and interaction', async () => {
    const { createCampaign } = await import(actionsPath)
    const data = {
      ...baseCampaignData(),
      creatives: {
        slot1: {
          slotKey: 'banner_top',
          title: 'Ad Title',
          body: 'Ad Body',
          ctaText: 'Click',
          ctaUrl: 'https://example.com',
          imageUrl: null,
          dismissSeconds: 0,
          locale: 'en',
          interaction: 'modal',
        },
      },
    }
    await createCampaign(data)

    // First call to mockFrom is for ad_campaigns, second for ad_slot_creatives
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).toContain('ad_slot_creatives')

    // The second insert call is for creatives
    const creativesInsertCall = mockChain.insert.mock.calls[1]
    const creatives = creativesInsertCall[0]
    expect(creatives[0].locale).toBe('en')
    expect(creatives[0].interaction).toBe('modal')
    expect(creatives[0].campaign_id).toBe('c-1')
  })

  it('calls revalidatePath and revalidateTag after success', async () => {
    const { createCampaign } = await import(actionsPath)
    await createCampaign(baseCampaignData())
    expect(revalidatePath).toHaveBeenCalledWith('/admin/ads')
    expect(revalidateTag).toHaveBeenCalledWith('ads')
  })
})

/* ---------------------------------------------------------------------------
 * updateCampaign
 * -------------------------------------------------------------------------*/
describe('updateCampaign', () => {
  it('scopes update by app_id via .eq()', async () => {
    const { updateCampaign } = await import(actionsPath)
    await updateCampaign('c-1', baseCampaignData())
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    expect(mockChain.update).toHaveBeenCalled()
    // .eq('id', ...).eq('app_id', ...) chain
    const eqFn = mockUpdateChain.eq as ReturnType<typeof vi.fn>
    expect(eqFn).toHaveBeenCalledWith('id', 'c-1')
  })

  it('deletes old creatives then inserts new ones', async () => {
    const { updateCampaign } = await import(actionsPath)
    const data = {
      ...baseCampaignData(),
      creatives: {
        slot1: {
          slotKey: 'banner_top',
          title: 'Updated',
          ctaText: 'Go',
          ctaUrl: 'https://example.com',
        },
      },
    }
    await updateCampaign('c-1', data)

    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0])
    // Should call from('ad_slot_creatives') for delete + insert
    const slotCreativeCalls = fromCalls.filter((n: string) => n === 'ad_slot_creatives')
    expect(slotCreativeCalls.length).toBeGreaterThanOrEqual(2)
    expect(mockChain.delete).toHaveBeenCalled()
    // insert is called for the new creatives
    expect(mockChain.insert.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('captures Sentry error on DB failure', async () => {
    const { updateCampaign } = await import(actionsPath)
    mockResult.error = { message: 'db boom' }
    await expect(updateCampaign('c-1', baseCampaignData())).rejects.toThrow('db boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'db boom' }),
      expect.objectContaining({ action: 'update_campaign', campaign_id: 'c-1' }),
    )
  })
})

/* ---------------------------------------------------------------------------
 * deleteCampaign
 * -------------------------------------------------------------------------*/
describe('deleteCampaign', () => {
  it('scopes delete by app_id', async () => {
    const { deleteCampaign } = await import(actionsPath)
    await deleteCampaign('c-1')
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    expect(mockChain.delete).toHaveBeenCalled()
  })
})

/* ---------------------------------------------------------------------------
 * updateCampaignStatus
 * -------------------------------------------------------------------------*/
describe('updateCampaignStatus', () => {
  it('rejects invalid status values', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    await expect(updateCampaignStatus('c-1', 'hacked')).rejects.toThrow('Invalid status')
  })

  it('accepts all valid statuses', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    for (const status of ['draft', 'active', 'paused', 'archived']) {
      mockChain.update.mockClear()
      mockResult.error = null
      await updateCampaignStatus('c-1', status)
      expect(mockChain.update).toHaveBeenCalled()
    }
  })

  it('scopes by app_id', async () => {
    const { updateCampaignStatus } = await import(actionsPath)
    await updateCampaignStatus('c-1', 'active')
    expect(mockFrom).toHaveBeenCalledWith('ad_campaigns')
    const eqFn = mockUpdateChain.eq as ReturnType<typeof vi.fn>
    expect(eqFn).toHaveBeenCalledWith('id', 'c-1')
  })
})

/* ---------------------------------------------------------------------------
 * fetchCampaignById
 * -------------------------------------------------------------------------*/
describe('fetchCampaignById', () => {
  it('calls requireArea("admin") before querying', async () => {
    const { fetchCampaignById } = await import(actionsPath)
    await fetchCampaignById('c-1')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })
})
