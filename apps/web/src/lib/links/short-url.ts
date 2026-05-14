export function buildShortUrl(code: string): string {
  const shortDomain = process.env.LINKS_SHORT_DOMAIN
  if (shortDomain) {
    return `https://${shortDomain}/${code}`
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  return `${appUrl}/go/${code}`
}
