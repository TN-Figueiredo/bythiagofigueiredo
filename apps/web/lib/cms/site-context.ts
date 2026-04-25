import { headers } from 'next/headers'

export interface SiteContext {
  siteId: string
  orgId: string
  defaultLocale: string
  /**
   * The host the middleware matched to this site. In production this is the
   * canonical public domain (e.g. `bythiagofigueiredo.com`); in dev it may be
   * `dev.localhost` or a `*.vercel.app` preview host. Optional because
   * middleware may not always attach a hostname (tests, rewrites).
   *
   * Track F2 — exposed so shell consumers (login page branding fallback,
   * cross-site redirect URLs in the site switcher) can display or link to
   * the domain without a second DB round-trip.
   */
  primaryDomain?: string
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
  const defaultLocale = h.get('x-default-locale') ?? 'en'
  // Middleware may set an explicit `x-primary-domain` header (Track A
  // follow-up); until then we derive a best-effort value from the request
  // `host` header (strips port for `dev.localhost:3001`).
  const explicitDomain = h.get('x-primary-domain')
  const hostHeader = h.get('host')
  const primaryDomain =
    explicitDomain ?? (hostHeader ? hostHeader.split(':')[0] : undefined)
  if (!siteId || !orgId) {
    throw new Error(
      'Site context not set — middleware should have resolved it. Hostname may not match any site.',
    )
  }
  return { siteId, orgId, defaultLocale, primaryDomain }
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
