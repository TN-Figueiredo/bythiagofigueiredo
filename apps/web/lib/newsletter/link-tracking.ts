import type { SupabaseClient } from '@supabase/supabase-js'

const SKIP_PATTERNS = [
  /^mailto:/i,
  /^#/,
  /\/newsletter\/unsubscribe/i,
  /\/newsletter\/preferences/i,
  /list-unsubscribe/i,
]

// ---------------------------------------------------------------------------
// Legacy tracker — encodes the destination URL inline in the click-tracking
// URL. Used when LINKS_NEWSLETTER_REWRITE_ENABLED is false.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Unified rewriter — persists each unique destination as a `tracked_links` row
// (source_type='newsletter', source_id=editionId) and rewrites every href to
// the short-domain redirect URL with UTM params appended.
//
// Behaviour contract:
//   - Idempotent: upserts on (site_id, destination_url) so crash recovery is
//     safe — re-running produces the same short codes.
//   - Skip patterns identical to the legacy rewriter.
//   - Returns { html, linkCount } so the caller can log / assert.
// ---------------------------------------------------------------------------
export interface RewriteResult {
  html: string
  linkCount: number
}

export async function rewriteLinksUnified(opts: {
  html: string
  supabase: SupabaseClient
  siteId: string
  editionId: string
  shortDomain: string
  campaignSlug: string
}): Promise<RewriteResult> {
  const { html, supabase, siteId, editionId, shortDomain, campaignSlug } = opts
  if (!html) return { html: '', linkCount: 0 }

  // 1. Collect every unique href that should be rewritten.
  const hrefs = new Set<string>()
  html.replace(/<a[^>]*\shref="([^"]+)"[^>]*>/gi, (_, href: string) => {
    if (!SKIP_PATTERNS.some((pat) => pat.test(href))) hrefs.add(href)
    return _
  })

  if (hrefs.size === 0) return { html, linkCount: 0 }

  // 2. Upsert tracked_links rows for all unique hrefs.
  //    ON CONFLICT (site_id, destination_url) DO NOTHING so re-runs are safe.
  const rows = [...hrefs].map((destination_url) => ({
    site_id: siteId,
    destination_url,
    source_type: 'newsletter' as const,
    source_id: editionId,
  }))

  await supabase
    .from('tracked_links')
    .upsert(rows, { onConflict: 'site_id,destination_url', ignoreDuplicates: true })

  // 3. Fetch the short codes for every href we just upserted.
  const { data: links } = await supabase
    .from('tracked_links')
    .select('destination_url, code')
    .eq('site_id', siteId)
    .in('destination_url', [...hrefs])

  const codeMap = new Map<string, string>()
  for (const l of links ?? []) {
    codeMap.set(l.destination_url as string, l.code as string)
  }

  // 4. Rewrite hrefs. Any href that didn't get a code (DB error) falls back
  //    to the original URL so the email is never broken.
  let linkCount = 0
  const rewritten = html.replace(
    /<a([^>]*)\shref="([^"]+)"([^>]*)>/gi,
    (match, before, href, after) => {
      if (SKIP_PATTERNS.some((pat) => pat.test(href))) return match
      const code = codeMap.get(href)
      if (!code) return match // graceful fallback
      // Append UTM params if the destination doesn't already have utm_source.
      const separator = href.includes('?') ? '&' : '?'
      const utmSuffix = href.includes('utm_source')
        ? ''
        : `${separator}utm_source=newsletter&utm_medium=email&utm_campaign=${encodeURIComponent(campaignSlug)}`
      const shortUrl = `https://${shortDomain}/${code}${utmSuffix}`
      linkCount++
      return `<a${before} href="${shortUrl}"${after}>`
    },
  )

  return { html: rewritten, linkCount }
}
