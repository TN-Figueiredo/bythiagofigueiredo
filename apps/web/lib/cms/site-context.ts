import { headers } from 'next/headers'

export interface SiteContext {
  siteId: string
  orgId: string
  defaultLocale: string
}

/**
 * Read site context set by the middleware (hostname → site_id resolution).
 * Throws if not set — server components that need site scoping must be under
 * a route where middleware has resolved the host. For routes that don't
 * require site context (admin tools, API internals), don't call this.
 */
export async function getSiteContext(): Promise<SiteContext> {
  const h = await headers()
  const siteId = h.get('x-site-id')
  const orgId = h.get('x-org-id')
  const defaultLocale = h.get('x-default-locale') ?? 'pt-BR'
  if (!siteId || !orgId) {
    throw new Error('Site context not set — middleware should have resolved it. Hostname may not match any site.')
  }
  return { siteId, orgId, defaultLocale }
}

/**
 * Non-throwing variant. Returns null when site context is absent.
 * Use for routes that can fall back (e.g., /blog showing a 404 if no site).
 */
export async function tryGetSiteContext(): Promise<SiteContext | null> {
  try {
    return await getSiteContext()
  } catch {
    return null
  }
}
