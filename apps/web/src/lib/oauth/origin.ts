import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Where an OAuth flow is allowed to start and return.
 *
 * The allow-list comes from `sites.domains` (service client), NEVER from
 * `getSiteContext().primaryDomain` — that value derives from the `host` header
 * and would let the caller pick its own redirect target.
 */

export interface IOauthDenyDescriptor {
  status: 403
  code: 'cross_origin'
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]'])

/**
 * `supabase/seeds/dev.sql:76-79` appends `localhost` / `127.0.0.1` to the local
 * site's `domains`, so the allow-list branch must never see them: loopback is
 * decided by its own branch, which is closed in production.
 */
function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return LOOPBACK_HOSTNAMES.has(h) || h.endsWith('.localhost') || h.startsWith('127.')
}

function hostnameOf(hostHeader: string): string | null {
  const h = hostHeader.trim().toLowerCase()
  if (!h) return null
  if (h.startsWith('[')) {
    const end = h.indexOf(']')
    return end === -1 ? null : h.slice(0, end + 1)
  }
  const colon = h.indexOf(':')
  return colon === -1 ? h : h.slice(0, colon)
}

/**
 * Per-request memoisation. `cache()` from React is not usable here: outside a
 * React request scope it does not memoise at all (verified against react@19.2.7
 * — three calls, three executions), so the "two calls, one query" guarantee
 * would be false in every server context that is not a render, tests included.
 * A 60 s TTL is a superset of one-query-per-request; domains change only through
 * an admin action and are never attacker-controlled.
 */
const SITE_DOMAINS_TTL_MS = 60_000
const siteDomainsCache = new Map<string, { at: number; domains: string[] }>()

/** Test hook — clears the memo between cases. Not used by production code. */
export function __resetSiteDomainsCache(): void {
  siteDomainsCache.clear()
}

export async function getSiteDomains(siteId: string): Promise<string[]> {
  const cached = siteDomainsCache.get(siteId)
  if (cached && Date.now() - cached.at < SITE_DOMAINS_TTL_MS) return cached.domains

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select('domains')
    .eq('id', siteId)
    .maybeSingle()

  // Fail closed and do NOT cache a failure — a transient error must not pin an
  // empty allow-list for a minute.
  if (error || !data) return []

  const raw = (data as { domains?: unknown }).domains
  if (!Array.isArray(raw)) return []

  const domains = raw
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .map((d) => d.toLowerCase())
    .filter((d) => !isLoopbackHostname(d))

  siteDomainsCache.set(siteId, { at: Date.now(), domains })
  return domains
}

export function resolveOAuthOrigin(req: Request, allowedHosts: string[]): string | null {
  const hostHeader = req.headers.get('host')
  if (!hostHeader) return null
  const hostname = hostnameOf(hostHeader)
  if (!hostname) return null

  // (i) loopback first — deliberately refused in production AND in preview
  //     (`NODE_ENV === 'production'` covers both on Vercel).
  if (isLoopbackHostname(hostname)) {
    if (process.env.NODE_ENV === 'production') return null
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${hostHeader.trim().toLowerCase()}`
  }

  // (ii) allow-listed host — https, no port.
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()))
  if (allowed.has(hostname)) return `https://${hostname}`

  // (iii) anything else.
  return null
}

/**
 * Fetch Metadata guard for the START of a flow.
 *
 * Returns a DESCRIPTOR, never a `Response` and never a throw: the caller has to
 * render the refusal through `oauthResultHtml` (403 `text/html`), because the
 * route is opened in a window the user is looking at — JSON or a 500 there is a
 * dead end.
 *
 * Decision: a MISSING header ALLOWS. WebViews and in-app browsers send no Fetch
 * Metadata; refusing them would strand the owner on the device most likely to be
 * holding the alert. The real defence of the start is session + state HMAC +
 * origin + nonce.
 */
export function assertSameOriginFetch(req: Request): IOauthDenyDescriptor | null {
  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') {
    return { status: 403, code: 'cross_origin' }
  }
  return null
}
