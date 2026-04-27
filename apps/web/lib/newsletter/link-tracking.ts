const SKIP_PATTERNS = [
  /^mailto:/i,
  /^#/,
  /\/newsletter\/unsubscribe/i,
  /\/newsletter\/preferences/i,
  /list-unsubscribe/i,
]

export function rewriteLinksForTracking(html: string, sendId: string, baseUrl: string): string {
  if (!html) return ''

  return html.replace(
    /<a([^>]*)\shref="([^"]+)"([^>]*)>/gi,
    (match, before, href, after) => {
      if (SKIP_PATTERNS.some((pat) => pat.test(href))) {
        return match
      }

      const encodedUrl = Buffer.from(href).toString('base64url')
      const trackingUrl = `${baseUrl}/api/newsletters/track/click?s=${sendId}&u=${encodedUrl}`
      return `<a${before} href="${trackingUrl}"${after}>`
    },
  )
}
