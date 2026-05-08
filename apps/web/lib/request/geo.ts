export interface GeoData {
  country: string | null
  city: string | null
  region: string | null
}

type GeoProvider = 'auto' | 'stub'

function getProvider(): GeoProvider {
  const env = process.env.GEO_PROVIDER ?? 'auto'
  if (env === 'stub') return 'stub'
  return 'auto'
}

function resolveAuto(headers: Headers): GeoData {
  const country =
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    null
  const city =
    headers.get('x-vercel-ip-city') ??
    headers.get('cf-ipcity') ??
    null
  const region =
    headers.get('x-vercel-ip-country-region') ??
    headers.get('cf-ipregion') ??
    null
  return { country, city, region }
}

export function resolveGeo(headers: Headers): GeoData {
  if (getProvider() === 'stub') {
    return { country: null, city: null, region: null }
  }
  return resolveAuto(headers)
}
