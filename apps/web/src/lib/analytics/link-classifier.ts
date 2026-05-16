export type LinkType = 'internal' | 'external' | 'shortlink'

/**
 * Classify a link href based on the site's origin.
 * - `/go/` prefix or `go.` subdomain → shortlink
 * - Same origin → internal
 * - Everything else → external
 */
export function classifyLink(href: string, siteOrigin: string): LinkType {
  // Relative URLs starting with /go/ are shortlinks
  if (href.startsWith('/go/')) return 'shortlink'

  let url: URL
  try {
    url = new URL(href, siteOrigin)
  } catch {
    // Invalid URL — treat as external
    return 'external'
  }

  // Check for go. subdomain
  const originUrl = new URL(siteOrigin)
  const originBase = originUrl.hostname.replace(/^www\./, '')
  if (url.hostname === `go.${originBase}`) return 'shortlink'

  // Same origin → internal
  if (url.origin === originUrl.origin) return 'internal'

  // www variant
  const hrefBase = url.hostname.replace(/^www\./, '')
  if (hrefBase === originBase && url.protocol === originUrl.protocol) return 'internal'

  return 'external'
}

export function linkTypeBadgeColor(type: LinkType): string {
  switch (type) {
    case 'internal':
      return 'var(--color-int)'
    case 'external':
      return 'var(--color-link)'
    case 'shortlink':
      return 'var(--acc)'
  }
}

export function linkTypeLabel(type: LinkType): string {
  switch (type) {
    case 'internal':
      return 'Internal'
    case 'external':
      return 'External'
    case 'shortlink':
      return 'Shortlink'
  }
}
