export const KNOWN_CLICK_IDS = new Set<string>([
  'gclid', 'gbraid', 'wbraid', 'gclsrc', 'dclid',
  'fbclid', 'msclkid', 'ttclid', 'twclid',
  'li_fat_id', 'epik', 'rdt_cid', 'scid',
])

export const CANONICAL_CASING: Record<string, string> = {
  gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid',
  gclsrc: 'gclsrc', dclid: 'dclid', fbclid: 'fbclid',
  msclkid: 'msclkid', ttclid: 'ttclid', twclid: 'twclid',
  li_fat_id: 'li_fat_id', epik: 'epik', rdt_cid: 'rdt_cid',
  scid: 'ScCid',
}

const SAFE_VALUE_RE = /^[a-zA-Z0-9_\-=.%+]+$/
const MAX_VALUE_LENGTH = 500
const MAX_URL_LENGTH = 8192
// Minimum headroom required in destination URL to allow any click ID passthrough.
// Ensures we do not bloat already-long URLs even if the final length technically
// stays under MAX_URL_LENGTH.
const MIN_HEADROOM = 300

export interface PassthroughResult {
  url: URL
  forwarded: string[]
  rejected: string[]
}

export function safePassthrough(incomingUrl: URL, destinationUrl: URL): PassthroughResult {
  const destStr = destinationUrl.toString()
  const forwarded: string[] = []
  const rejected: string[] = []

  // Collect candidate click IDs from the incoming URL first
  const candidates: Array<{ rawName: string; canonicalName: string; value: string }> = []
  for (const [rawName, value] of incomingUrl.searchParams.entries()) {
    const lowerName = rawName.toLowerCase()
    if (lowerName.startsWith('utm_')) continue
    if (!KNOWN_CLICK_IDS.has(lowerName)) continue
    if (value.length === 0) continue
    if (value.length > MAX_VALUE_LENGTH) { rejected.push(rawName); continue }
    if (!SAFE_VALUE_RE.test(value)) { rejected.push(rawName); continue }
    candidates.push({ rawName, canonicalName: CANONICAL_CASING[lowerName] ?? rawName, value })
  }

  // If the destination URL leaves insufficient headroom, roll back before we start
  if (candidates.length > 0 && destStr.length > MAX_URL_LENGTH - MIN_HEADROOM) {
    return {
      url: new URL(destStr),
      forwarded: [],
      rejected: [...rejected, ...candidates.map(c => c.rawName)],
    }
  }

  const result = new URL(destStr)
  for (const { rawName, canonicalName, value } of candidates) {
    result.searchParams.set(canonicalName, value)
    forwarded.push(rawName)
  }

  // Final hard check: if the assembled URL still exceeds the absolute limit, roll back all
  if (result.toString().length > MAX_URL_LENGTH) {
    return { url: new URL(destStr), forwarded: [], rejected: [...rejected, ...forwarded] }
  }

  return { url: result, forwarded, rejected }
}

export function extractClickIds(url: URL): Record<string, string> {
  const ids: Record<string, string> = {}
  for (const [rawName, value] of url.searchParams.entries()) {
    const lowerName = rawName.toLowerCase()
    if (KNOWN_CLICK_IDS.has(lowerName) && value.length > 0) {
      ids[CANONICAL_CASING[lowerName] ?? rawName] = value
    }
  }
  return ids
}
