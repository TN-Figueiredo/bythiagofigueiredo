import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { isWaitlistStatus, type WaitlistStatus } from './_components/wl-badge'

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

interface CountRow {
  waitlist_id: string
  pending: number
  suppressed: number
}

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
      { tags: { component: 'waitlist' } },
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
      { tags: { component: 'waitlist' } },
    )
    throw cErr
  }

  const countMap = new Map<string, { pending: number; suppressed: number }>()
  for (const c of (counts ?? []) as CountRow[]) {
    countMap.set(c.waitlist_id, { pending: c.pending, suppressed: c.suppressed })
  }

  const rows: WaitlistListRow[] = (wls ?? []).map((w) => {
    const c = countMap.get(w.id) ?? { pending: 0, suppressed: 0 }
    // PostgREST returns an embedded to-one relation as an object, but the typed
    // client widens it to an array — normalize either shape to a minimally-typed value.
    const campaignRel = (Array.isArray(w.campaigns) ? w.campaigns[0] : w.campaigns) as
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
