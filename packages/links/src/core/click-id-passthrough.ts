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

export interface PassthroughResult {
  url: URL
  forwarded: string[]
  rejected: string[]
}

export function safePassthrough(_incomingUrl: URL, _destinationUrl: URL): PassthroughResult {
  throw new Error('Not implemented')
}

export function extractClickIds(_url: URL): Record<string, string> {
  throw new Error('Not implemented')
}
