import { revalidateTag } from 'next/cache'

/**
 * Invalidate cached data for a specific link.
 * Downstream consumers use `unstable_cache` with these tag keys.
 */
export function invalidateLink(siteId: string, code: string): void {
  revalidateTag(`link:${siteId}:${code}`)
}

/**
 * Invalidate the links list cache for a site.
 */
export function invalidateList(siteId: string): void {
  revalidateTag(`links:${siteId}`)
}

/**
 * Invalidate analytics cache for a specific link.
 */
export function invalidateAnalytics(linkId: string): void {
  revalidateTag(`link-analytics:${linkId}`)
}
