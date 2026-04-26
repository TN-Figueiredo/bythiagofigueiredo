import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelectChain = {
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
    Promise.resolve({ data: [], error: null }).then(resolve),
}
const mockUpsertChain = {
  select: vi.fn().mockReturnThis(),
  then: (resolve: (v: { data: unknown; error: null }) => void) =>
    Promise.resolve({ data: {}, error: null }).then(resolve),
}
const mockFrom = vi.fn((table: string) => {
  if (table === 'ad_slot_config') {
    return {
      select: vi.fn(() => mockSelectChain),
      upsert: vi.fn(() => mockUpsertChain),
    }
  }
  return { select: vi.fn(() => mockSelectChain) }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateTag } from 'next/cache'

const actionsPath = '../../src/app/admin/(authed)/ads/_actions/slot-config'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchSlotConfigs', () => {
  it('calls requireArea("admin") before querying', async () => {
    vi.resetModules()
    const { fetchSlotConfigs } = await import(actionsPath)
    await fetchSlotConfigs('bythiagofigueiredo')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('queries ad_slot_config filtered by app_id', async () => {
    vi.resetModules()
    const { fetchSlotConfigs } = await import(actionsPath)
    await fetchSlotConfigs('bythiagofigueiredo')
    expect(mockFrom).toHaveBeenCalledWith('ad_slot_config')
    expect(mockSelectChain.eq).toHaveBeenCalledWith('app_id', 'bythiagofigueiredo')
  })

  it('returns an array (empty when no rows)', async () => {
    vi.resetModules()
    const { fetchSlotConfigs } = await import(actionsPath)
    const result = await fetchSlotConfigs('bythiagofigueiredo')
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('updateSlotConfig', () => {
  it('calls requireArea("admin") before writing', async () => {
    vi.resetModules()
    const { updateSlotConfig } = await import(actionsPath)
    await updateSlotConfig('bythiagofigueiredo', 'banner_top', { enabled: true })
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('upserts into ad_slot_config with correct keys', async () => {
    vi.resetModules()
    const upsertSpy = vi.fn(() => mockUpsertChain)
    mockFrom.mockImplementationOnce(() => ({ upsert: upsertSpy, select: vi.fn(() => mockSelectChain) }))
    const { updateSlotConfig } = await import(actionsPath)
    await updateSlotConfig('bythiagofigueiredo', 'banner_top', {
      enabled: false,
      maxPerSession: 2,
      cooldownMs: 1800000,
    })
    expect(upsertSpy).toHaveBeenCalled()
    const upsertArg = upsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.app_id).toBe('bythiagofigueiredo')
    expect(upsertArg.slot_key).toBe('banner_top')
    expect(upsertArg.enabled).toBe(false)
    expect(upsertArg.max_per_session).toBe(2)
    expect(upsertArg.cooldown_ms).toBe(1800000)
  })

  it('revalidates ad:slot-config tag after update', async () => {
    vi.resetModules()
    const { updateSlotConfig } = await import(actionsPath)
    await updateSlotConfig('bythiagofigueiredo', 'rail_left', { enabled: true })
    expect(revalidateTag).toHaveBeenCalledWith('ad:slot-config:bythiagofigueiredo')
  })

  it('revalidates granular slot tag after update', async () => {
    vi.resetModules()
    const { updateSlotConfig } = await import(actionsPath)
    await updateSlotConfig('bythiagofigueiredo', 'rail_left', { enabled: true })
    expect(revalidateTag).toHaveBeenCalledWith('ad:slot:rail_left')
  })
})
