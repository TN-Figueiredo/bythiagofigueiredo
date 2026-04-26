import { describe, it, expect, vi, beforeEach } from 'vitest'

function loadFlags(env: Record<string, string | undefined>) {
  vi.resetModules()
  vi.stubEnv('AD_ENGINE_ENABLED', env.AD_ENGINE_ENABLED)
  vi.stubEnv('AD_GOOGLE_ENABLED', env.AD_GOOGLE_ENABLED)
  vi.stubEnv('AD_TRACKING_ENABLED', env.AD_TRACKING_ENABLED)
  vi.stubEnv('AD_REVENUE_SYNC_ENABLED', env.AD_REVENUE_SYNC_ENABLED)
  return import('../../src/lib/ads/flags')
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('AD_ENGINE_ENABLED', () => {
  it('is true by default (env var unset)', async () => {
    const { AD_ENGINE_ENABLED } = await loadFlags({})
    expect(AD_ENGINE_ENABLED).toBe(true)
  })

  it('is false when set to "false"', async () => {
    const { AD_ENGINE_ENABLED } = await loadFlags({ AD_ENGINE_ENABLED: 'false' })
    expect(AD_ENGINE_ENABLED).toBe(false)
  })

  it('is true when set to "true"', async () => {
    const { AD_ENGINE_ENABLED } = await loadFlags({ AD_ENGINE_ENABLED: 'true' })
    expect(AD_ENGINE_ENABLED).toBe(true)
  })

  it('is true for any value other than "false" (e.g. "0")', async () => {
    const { AD_ENGINE_ENABLED } = await loadFlags({ AD_ENGINE_ENABLED: '0' })
    expect(AD_ENGINE_ENABLED).toBe(true)
  })
})

describe('AD_GOOGLE_ENABLED', () => {
  it('is false by default (env var unset)', async () => {
    const { AD_GOOGLE_ENABLED } = await loadFlags({})
    expect(AD_GOOGLE_ENABLED).toBe(false)
  })

  it('is true when set to "true"', async () => {
    const { AD_GOOGLE_ENABLED } = await loadFlags({ AD_GOOGLE_ENABLED: 'true' })
    expect(AD_GOOGLE_ENABLED).toBe(true)
  })

  it('is false for any value other than "true"', async () => {
    const { AD_GOOGLE_ENABLED } = await loadFlags({ AD_GOOGLE_ENABLED: 'yes' })
    expect(AD_GOOGLE_ENABLED).toBe(false)
  })
})

describe('AD_TRACKING_ENABLED', () => {
  it('is true by default (env var unset)', async () => {
    const { AD_TRACKING_ENABLED } = await loadFlags({})
    expect(AD_TRACKING_ENABLED).toBe(true)
  })

  it('is false when set to "false"', async () => {
    const { AD_TRACKING_ENABLED } = await loadFlags({ AD_TRACKING_ENABLED: 'false' })
    expect(AD_TRACKING_ENABLED).toBe(false)
  })
})

describe('AD_REVENUE_SYNC_ENABLED', () => {
  it('is false by default (env var unset)', async () => {
    const { AD_REVENUE_SYNC_ENABLED } = await loadFlags({})
    expect(AD_REVENUE_SYNC_ENABLED).toBe(false)
  })

  it('is true when set to "true"', async () => {
    const { AD_REVENUE_SYNC_ENABLED } = await loadFlags({ AD_REVENUE_SYNC_ENABLED: 'true' })
    expect(AD_REVENUE_SYNC_ENABLED).toBe(true)
  })
})

describe('flags shape', () => {
  it('exports exactly 4 flags', async () => {
    const mod = await loadFlags({})
    const keys = Object.keys(mod).filter((k) => k.startsWith('AD_'))
    expect(keys.sort()).toEqual(
      ['AD_ENGINE_ENABLED', 'AD_GOOGLE_ENABLED', 'AD_REVENUE_SYNC_ENABLED', 'AD_TRACKING_ENABLED'].sort(),
    )
  })
})
