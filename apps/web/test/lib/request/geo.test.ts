import { describe, it, expect, vi, afterEach } from 'vitest'

describe('resolveGeo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadGeo() {
    const mod = await import('../../../lib/request/geo')
    return mod.resolveGeo
  }

  it('prefers Vercel headers over Cloudflare', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-city': 'New York',
      'x-vercel-ip-country-region': 'NY',
      'cf-ipcountry': 'BR',
      'cf-ipcity': 'Sao Paulo',
      'cf-ipregion': 'SP',
    })
    expect(resolveGeo(headers)).toEqual({ country: 'US', city: 'New York', region: 'NY' })
  })

  it('falls back to Cloudflare headers when Vercel absent', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'cf-ipcountry': 'BR',
      'cf-ipcity': 'Sao Paulo',
      'cf-ipregion': 'SP',
    })
    expect(resolveGeo(headers)).toEqual({ country: 'BR', city: 'Sao Paulo', region: 'SP' })
  })

  it('returns partial geo when some headers missing', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({ 'cf-ipcountry': 'US' })
    expect(resolveGeo(headers)).toEqual({ country: 'US', city: null, region: null })
  })

  it('returns all nulls when no geo headers present', async () => {
    const resolveGeo = await loadGeo()
    expect(resolveGeo(new Headers({}))).toEqual({ country: null, city: null, region: null })
  })

  it('returns all nulls when GEO_PROVIDER=stub', async () => {
    vi.stubEnv('GEO_PROVIDER', 'stub')
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'cf-ipcountry': 'BR',
      'x-vercel-ip-country': 'US',
    })
    expect(resolveGeo(headers)).toEqual({ country: null, city: null, region: null })
  })

  it('uses Vercel country even when city comes from Cloudflare', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'x-vercel-ip-country': 'CA',
      'cf-ipcity': 'Toronto',
    })
    const geo = resolveGeo(headers)
    expect(geo.country).toBe('CA')
    expect(geo.city).toBe('Toronto')
  })
})
