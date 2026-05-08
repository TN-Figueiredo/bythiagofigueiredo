import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveGeo } from '../../../lib/request/geo'

describe('resolveGeo', () => {
  beforeEach(() => {
    vi.stubEnv('GEO_PROVIDER', 'auto')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts geo from Cloudflare headers', () => {
    const headers = new Headers({
      'cf-ipcountry': 'BR',
      'cf-ipcity': 'Sao Paulo',
      'cf-ipregion': 'SP',
    })
    const geo = resolveGeo(headers)
    expect(geo).toEqual({ country: 'BR', city: 'Sao Paulo', region: 'SP' })
  })

  it('returns partial geo when some headers missing', () => {
    const headers = new Headers({ 'cf-ipcountry': 'US' })
    const geo = resolveGeo(headers)
    expect(geo).toEqual({ country: 'US', city: null, region: null })
  })

  it('returns all nulls when no geo headers present', () => {
    const headers = new Headers({})
    const geo = resolveGeo(headers)
    expect(geo).toEqual({ country: null, city: null, region: null })
  })

  it('uses stub provider in dev when LINKS_GEO_PROVIDER=stub', async () => {
    vi.stubEnv('GEO_PROVIDER', 'stub')
    vi.resetModules()
    const mod = await import('../../../lib/request/geo')
    const headers = new Headers({})
    const geo = mod.resolveGeo(headers)
    expect(geo).toEqual({ country: null, city: null, region: null })
  })
})

describe('GeoData type', () => {
  it('exports GeoData interface with correct shape', () => {
    const result = resolveGeo(new Headers({}))
    expect(result).toHaveProperty('country')
    expect(result).toHaveProperty('city')
    expect(result).toHaveProperty('region')
  })
})
