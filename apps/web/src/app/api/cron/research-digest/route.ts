// ---------------------------------------------------------------------------
// /api/cron/research-digest — weekly proactive Research Strategist push.
//
// Computes the digest signals (the same logic behind the
// pipeline://research/digest resource), builds the plain-PT-BR
// summary_for_owner, picks the SINGLE highest-priority recommendation
// (Preflight order: revisit vencido > foco órfão > tema maduro > research
// stale), and pushes ONE notification to the site owner with it.
//
// suggest-don't-nag: if nothing is worth surfacing, no notification is sent.
// One notification per site per run, max. The weekly dedup_key makes re-runs
// within the same ISO week idempotent.
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { createNotification } from '@/lib/notifications/create'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import {
  computeResearchDigest,
  pickRecommendation,
  buildSummaryForOwner,
} from '@/lib/pipeline/research-digest'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_NAME = 'research-digest'
const NOTIFICATION_TYPE = 'pipeline.research_digest'

/** ISO-week-ish stable segment (YYYY-Www) so re-runs in the same week dedup. */
function isoWeekSegment(now: Date): string {
  // Copy and shift to Thursday of the current week (ISO 8601).
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

async function handle(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseServiceClient()
    const now = new Date()
    const weekSeg = isoWeekSegment(now)

    // Scope: every site that has research data. Mirror other crons that fan
    // out per site; research is keyed by site_id.
    const { data: sites, error: sitesErr } = await supabase
      .from('sites')
      .select('id')

    if (sitesErr) throw new Error(`failed to list sites: ${sitesErr.message}`)

    let notified = 0
    let skipped = 0
    const perSite: Array<{ siteId: string; recommendation: string | null }> = []

    for (const site of sites ?? []) {
      const siteId = site.id as string

      const signals = await computeResearchDigest(supabase, siteId, now.getTime())
      const recommendation = pickRecommendation(signals)
      const summary = buildSummaryForOwner(signals, recommendation)

      perSite.push({ siteId, recommendation: recommendation?.kind ?? null })

      // suggest-don't-nag: nothing worth surfacing → no notification.
      if (!recommendation) {
        skipped++
        continue
      }

      // Resolve the owner (super_admin). Same pattern as ab-watchdog.
      const { data: owner } = await supabase
        .from('site_users')
        .select('user_id')
        .eq('site_id', siteId)
        .eq('role', 'super_admin')
        .limit(1)
        .single()

      if (!owner) {
        skipped++
        continue
      }

      const result = await createNotification({
        site_id: siteId,
        user_id: owner.user_id,
        type: NOTIFICATION_TYPE,
        domain: 'pipeline',
        priority: 2,
        title: 'Resumo da estratégia de research',
        message: summary.recomendo_agora,
        action_href: recommendation.action_href,
        // One per site per ISO week per recommendation kind. The recommendation
        // segment keeps the dedup tight while still allowing a different surface
        // if the situation changes within the week.
        dedup_key: `research-digest:${siteId}:${weekSeg}:${recommendation.dedupSegment}`,
        suggested_action: summary.recomendo_agora.slice(0, 200),
        payload: {
          summary,
          kind: recommendation.kind,
          weekSeg,
          totalItems: signals.totalItems,
          maturingThemes: signals.maturingThemes.length,
          revisitDue: signals.revisitDue.length,
          staleFresca: signals.staleFresca.length,
          staleAnalise: signals.staleAnalise.length,
        },
      })

      if (result.success && !result.suppressed) {
        notified++
      } else {
        skipped++
      }
    }

    await recordCronSuccess(CRON_NAME, 'info')

    return Response.json({
      status: 'ok',
      sites: (sites ?? []).length,
      notified,
      skipped,
      week: weekSeg,
      perSite,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: CRON_NAME } })
    await recordCronFailure(CRON_NAME, (err as Error).message)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req)
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req)
}
