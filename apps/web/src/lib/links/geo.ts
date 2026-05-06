export interface GeoData {
  country: string | null
  city: string | null
  region: string | null
}

type GeoProvider = 'cloudflare' | 'stub'

function getProvider(): GeoProvider {
  const env = process.env.LINKS_GEO_PROVIDER ?? 'cloudflare'
  if (env === 'stub') return 'stub'
  return 'cloudflare'
}

function resolveFromCloudflare(headers: Headers): GeoData {
  return {
    country: headers.get('cf-ipcountry') ?? null,
    city: headers.get('cf-ipcity') ?? null,
    region: headers.get('cf-ipregion') ?? null,
  }
}

function resolveStub(): GeoData {
  return { country: null, city: null, region: null }
}

/**
 * Resolve visitor geo from request headers.
 * Strategy pattern via LINKS_GEO_PROVIDER env var.
 * Default: Cloudflare headers. Fallback: stub for dev.
 */
export function resolveGeo(headers: Headers): GeoData {
  const provider = getProvider()
  switch (provider) {
    case 'cloudflare':
      return resolveFromCloudflare(headers)
    case 'stub':
      return resolveStub()
    default:
      return resolveStub()
  }
}
