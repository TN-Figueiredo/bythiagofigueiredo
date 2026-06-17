import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { isWaitlistStatus, type WaitlistStatus } from '../../../../../lib/waitlists/status'

export interface WaitlistListRow {
  id: string
  slug: string
  name: string
  status: WaitlistStatus
  campaignId: string | null
  campaignTitle: string | null
  updatedAt: string
  /** pending + suppressed (non-anonymized) */
  signups: number
  suppressed: number
  // Editable scalars carried so the CMS edit drawer hydrates FULLY — updateWaitlist
  // writes the whole scalar patch, so a partially-hydrated form would blank these
  // columns on save (data loss). At Fase-1 scale (few waitlists/site) fetching them
  // with the list is cheap; switch to a fetch-on-edit query if lists grow large.
  description: string | null
  intro: string | null
  senderName: string | null
  senderEmail: string | null
  replyTo: string | null
}

export interface WaitlistListKpis {
  total: number
  open: number
  totalSignups: number
  suppressed: number
  linkedCampaigns: number
  /** failed + launching — operator attention (a launch that errored or is in flight) */
  needsAttention: number
}

export interface WaitlistListResult {
  rows: WaitlistListRow[]
  kpis: WaitlistListKpis
}

// Validate the waitlist_signup_counts RPC result rather than `as`-casting it — silent
// schema drift would coerce missing counts to 0 and mask data loss in the KPI strip.
const CountRowsSchema = z.array(
  z.object({
    waitlist_id: z.string(),
    pending: z.number().int().nonnegative(),
    suppressed: z.number().int().nonnegative(),
  }),
)

/**
 * Site-scoped waitlist list + KPI strip for the CMS. Callers MUST already have
 * established edit access to `siteId` (the CMS layout / server actions do this);
 * the service client bypasses RLS, so the `.eq('site_id', siteId)` here is the
 * cross-ring boundary. Per-waitlist counts come from the `waitlist_signup_counts`
 * SECURITY DEFINER aggregate (one round-trip — PostgREST can't GROUP BY).
 */
export async function listWaitlistsForSite(siteId: string): Promise<WaitlistListResult> {
  const supabase = getSupabaseServiceClient()

  const { data: wls, error } = await supabase
    .from('waitlists')
    .select(
      'id, slug, name, status, campaign_id, updated_at, description, intro_mdx, sender_name, sender_email, reply_to, campaigns(interest)',
    )
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
  if (error) {
    getLogger().error('[listWaitlistsForSite]', { code: error.code })
    Sentry.captureException(
      new Error(`listWaitlistsForSite ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist', action: 'listWaitlistsForSite' } },
    )
    throw error
  }

  const { data: counts, error: cErr } = await supabase.rpc('waitlist_signup_counts', {
    p_site_id: siteId,
  })
  if (cErr) {
    getLogger().error('[listWaitlistsForSite:counts]', { code: cErr.code })
    Sentry.captureException(
      new Error(`listWaitlistsForSite ${cErr.code}: ${redactMessage(cErr.message ?? '')}`),
      { tags: { component: 'waitlist', action: 'listWaitlistsForSite' } },
    )
    throw cErr
  }

  const parsedCounts = CountRowsSchema.safeParse(counts ?? [])
  if (!parsedCounts.success) {
    getLogger().error('[listWaitlistsForSite:counts] unexpected RPC shape', {})
    Sentry.captureException(new Error('waitlist_signup_counts: unexpected RPC result shape'), {
      tags: { component: 'waitlist', action: 'listWaitlistsForSite' },
    })
    throw new Error('waitlist_signup_counts: unexpected RPC result shape')
  }
  const countMap = new Map<string, { pending: number; suppressed: number }>()
  for (const c of parsedCounts.data) {
    countMap.set(c.waitlist_id, { pending: c.pending, suppressed: c.suppressed })
  }

  const rows: WaitlistListRow[] = (wls ?? []).map((w) => {
    const c = countMap.get(w.id) ?? { pending: 0, suppressed: 0 }
    // PostgREST returns an embedded to-one relation as an object, but the typed
    // client widens it to an array — normalize either shape to a minimally-typed value.
    const campaignRel = (Array.isArray(w.campaigns) ? w.campaigns.at(0) : w.campaigns) as
      | { interest: string | null }
      | null
      | undefined
    return {
      id: w.id,
      slug: w.slug,
      name: w.name,
      // DB CHECK constrains status to the 6 literals, but narrow at runtime rather than
      // `as`-cast (matches the requireRowId/requireStatus discipline in actions.ts).
      status: isWaitlistStatus(w.status) ? w.status : 'draft',
      campaignId: w.campaign_id,
      // `interest` is the campaign's always-present label (same fallback the
      // campaigns module uses: meta_title ?? interest ?? 'Untitled').
      campaignTitle: campaignRel?.interest ?? null,
      updatedAt: w.updated_at,
      signups: c.pending + c.suppressed,
      suppressed: c.suppressed,
      description: w.description ?? null,
      intro: w.intro_mdx ?? null,
      senderName: w.sender_name ?? null,
      senderEmail: w.sender_email ?? null,
      replyTo: w.reply_to ?? null,
    }
  })

  const kpis: WaitlistListKpis = {
    total: rows.length,
    open: rows.filter((r) => r.status === 'open').length,
    totalSignups: rows.reduce((sum, r) => sum + r.signups, 0),
    suppressed: rows.reduce((sum, r) => sum + r.suppressed, 0),
    linkedCampaigns: rows.filter((r) => r.campaignId !== null).length,
    needsAttention: rows.filter((r) => r.status === 'failed' || r.status === 'launching').length,
  }

  return { rows, kpis }
}

export interface SignupRow {
  id: string
  email: string
  status: 'pending' | 'suppressed'
  suppressionReason: string | null
  sourceSurface: string | null
  createdAt: string
}

/** Display labels for source_surface — single source of truth (used by the detail page + signups tab). */
export const WAITLIST_SOURCE_LABELS = {
  landing: 'Landing page',
  embed: 'Embed',
  tiptap: 'In-article',
} as const satisfies Record<'landing' | 'embed' | 'tiptap', string>

function isSignupStatus(s: unknown): s is 'pending' | 'suppressed' {
  return s === 'pending' || s === 'suppressed'
}

export interface SignupsCursor {
  createdAt: string
  id: string
}

// The keyset cursor is interpolated into a PostgREST .or() filter string, so its parts MUST
// be validated (they originate from a user-controlled URL param) — otherwise a crafted cursor
// injects arbitrary filter syntax. Same guard the playlists module uses.
// End-anchored: a valid ISO timestamp ONLY (optional fractional seconds + Z/offset) — an
// unanchored prefix match would let `2026-..T..:..:..<INJECTION>` through into the filter.
// Require the timezone (Z or ±offset) — Postgres timestamptz always serializes one, so a
// TZ-less string isn't a real cursor value; tightening avoids accepting looser inputs.
const CURSOR_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/
const CURSOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidCursor(c: SignupsCursor): boolean {
  return CURSOR_ISO_RE.test(c.createdAt) && CURSOR_UUID_RE.test(c.id)
}

/**
 * Parse the `?c=<createdAt>|<id>` URL param into a validated cursor, or undefined when
 * absent/malformed (so a tampered param degrades to page 1, never an injected filter).
 */
export function parseSignupsCursor(c: string | undefined): SignupsCursor | undefined {
  if (!c) return undefined
  const sep = c.indexOf('|')
  if (sep <= 0) return undefined
  const cursor = { createdAt: c.slice(0, sep), id: c.slice(sep + 1) }
  return isValidCursor(cursor) ? cursor : undefined
}

export interface ListSignupsOpts {
  status?: 'pending' | 'suppressed'
  /** Email prefix filter (case-insensitive; wildcards escaped). */
  q?: string
  /** Keyset cursor from a previous page's `nextCursor`. */
  cursor?: SignupsCursor
  pageSize?: number
}

export interface SignupsPage {
  rows: SignupRow[]
  // Forward-only by design (Fase 1): a keyset cursor + estimated count gives O(1) "Next"
  // without an offset scan; there is intentionally no Prev (back-history can be added
  // client-side later if needed). null when there are no more rows.
  nextCursor: SignupsCursor | null
  /** Index-stats estimate (O(1)); exact COUNT on 100k rows is too costly per page. */
  estimatedTotal: number | null
}

const SIGNUPS_PAGE_SIZE = 25

/**
 * Server-side, site-scoped signups list with a ROW-VALUE keyset cursor on
 * `(created_at desc, id desc)` — correct even when many rows share a `created_at`
 * (a bare `created_at.lt` cursor would skip or duplicate those). Optional status +
 * email-prefix filters run in SQL (the prefix's `%`/`_`/`\` are escaped so a user
 * can't inject wildcards — M13). Returns one extra row to derive `nextCursor` without
 * a second round-trip; the total is `estimated` (index stats), never an exact COUNT.
 */
export async function listSignups(
  siteId: string,
  waitlistId: string,
  opts: ListSignupsOpts = {},
): Promise<SignupsPage> {
  const supabase = getSupabaseServiceClient()
  const pageSize = opts.pageSize ?? SIGNUPS_PAGE_SIZE

  let query = supabase
    .from('waitlist_signups')
    .select('id, email, status, suppression_reason, source_surface, created_at', { count: 'estimated' })
    .eq('waitlist_id', waitlistId)
    .eq('site_id', siteId)
    .is('anonymized_at', null)

  if (opts.status) query = query.eq('status', opts.status)
  if (opts.q) {
    const safe = opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)
    query = query.ilike('email', `${safe}%`)
  }
  // Defense-in-depth: only interpolate the cursor into the .or() filter if it passes the
  // ISO/UUID guard (the page also validates via parseSignupsCursor). An invalid cursor is
  // dropped → first page, never an injected filter string.
  if (opts.cursor && isValidCursor(opts.cursor)) {
    const { createdAt, id } = opts.cursor
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1)
  if (error) {
    getLogger().error('[listSignups]', { code: error.code })
    Sentry.captureException(
      new Error(`listSignups ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist', action: 'listSignups' } },
    )
    throw error
  }

  const raw = (data ?? []) as Array<{
    id: string
    email: string
    status: string
    suppression_reason: string | null
    source_surface: string | null
    created_at: string
  }>
  const hasNext = raw.length > pageSize
  const pageRaw = hasNext ? raw.slice(0, pageSize) : raw
  const last = pageRaw[pageRaw.length - 1]

  return {
    rows: pageRaw.map((r) => ({
      id: r.id,
      email: r.email,
      status: isSignupStatus(r.status) ? r.status : 'pending',
      suppressionReason: r.suppression_reason,
      sourceSurface: r.source_surface,
      createdAt: r.created_at,
    })),
    nextCursor: hasNext && last ? { createdAt: last.created_at, id: last.id } : null,
    estimatedTotal: count ?? null,
  }
}

export interface WaitlistDetailData {
  id: string
  slug: string
  name: string
  status: WaitlistStatus
  description: string | null
  intro: string | null
  campaignId: string | null
  senderName: string | null
  senderEmail: string | null
  replyTo: string | null
  /** Signups grouped by source surface (non-anonymized). Fase 1 only ever writes `landing`. */
  sourceCounts: { landing: number; embed: number; tiptap: number }
  pending: number
  suppressed: number
}

/**
 * Load a single waitlist for the CMS detail page, IDOR-guarded: the row is resolved with
 * BOTH `.eq('id', id)` AND `.eq('site_id', siteId)`, so a cross-site id matches nothing and
 * returns null (the caller 404s) — never another ring's data. Signup tallies are O(1)
 * head-count queries (no row transfer). Returns null when the waitlist is not owned/found.
 */
export async function loadWaitlistDetail(siteId: string, id: string): Promise<WaitlistDetailData | null> {
  const supabase = getSupabaseServiceClient()

  const { data: wl, error } = await supabase
    .from('waitlists')
    .select('id, slug, name, status, description, intro_mdx, campaign_id, sender_name, sender_email, reply_to')
    .eq('id', id)
    .eq('site_id', siteId)
    .maybeSingle()
  if (error) {
    getLogger().error('[loadWaitlistDetail]', { code: error.code })
    Sentry.captureException(
      new Error(`loadWaitlistDetail ${error.code}: ${redactMessage(error.message ?? '')}`),
      { tags: { component: 'waitlist', action: 'loadWaitlistDetail' } },
    )
    throw error
  }
  if (!wl) return null

  const countFor = (col: 'source_surface' | 'status', val: string) =>
    supabase
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .eq('waitlist_id', id)
      .eq('site_id', siteId)
      .eq(col, val)
      .is('anonymized_at', null)

  const [landing, embed, tiptap, pending, suppressed] = await Promise.all([
    countFor('source_surface', 'landing'),
    countFor('source_surface', 'embed'),
    countFor('source_surface', 'tiptap'),
    countFor('status', 'pending'),
    countFor('status', 'suppressed'),
  ])

  // A silent count error would coerce to 0 and mask signup-count loss on the detail page
  // (same drift class listWaitlistsForSite guards). Throw on the first error.
  for (const r of [landing, embed, tiptap, pending, suppressed]) {
    if (r.error) {
      getLogger().error('[loadWaitlistDetail:counts]', { code: r.error.code })
      Sentry.captureException(
        new Error(`loadWaitlistDetail:counts ${r.error.code}: ${redactMessage(r.error.message ?? '')}`),
        { tags: { component: 'waitlist', action: 'loadWaitlistDetail' } },
      )
      throw r.error
    }
  }

  return {
    id: wl.id,
    slug: wl.slug,
    name: wl.name,
    status: isWaitlistStatus(wl.status) ? wl.status : 'draft',
    description: wl.description ?? null,
    intro: wl.intro_mdx ?? null,
    campaignId: wl.campaign_id,
    senderName: wl.sender_name ?? null,
    senderEmail: wl.sender_email ?? null,
    replyTo: wl.reply_to ?? null,
    sourceCounts: {
      landing: landing.count ?? 0,
      embed: embed.count ?? 0,
      tiptap: tiptap.count ?? 0,
    },
    pending: pending.count ?? 0,
    suppressed: suppressed.count ?? 0,
  }
}
