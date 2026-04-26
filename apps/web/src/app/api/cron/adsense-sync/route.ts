import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { decrypt } from '@/lib/ads/crypto'
import * as Sentry from '@sentry/nextjs'

const JOB = 'adsense-sync'
const LOCK_KEY = 'cron:adsense-sync'

function adUnitToSlotKey(adUnitCode: string): string {
  const mapping: Record<string, string> = {
    banner_top: 'banner_top',
    rail_left: 'rail_left',
    rail_right: 'rail_right',
    inline_mid: 'inline_mid',
    block_bottom: 'block_bottom',
  }
  for (const [key, slotKey] of Object.entries(mapping)) {
    if (adUnitCode.includes(key)) return slotKey
  }
  return adUnitCode.split('/').pop() ?? adUnitCode
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error ?? 'unknown'}`)
  }
  return data.access_token
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.AD_REVENUE_SYNC_ENABLED !== 'true') {
    return new Response(null, { status: 204 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const tokenKey = process.env.ADSENSE_TOKEN_KEY

    if (!clientId || !clientSecret || !tokenKey) {
      return { status: 'error' as const, err_code: 'missing_config', error: 'AdSense not configured' }
    }

    const { data: orgId } = await supabase.rpc('get_master_org_id')
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, adsense_refresh_token_enc, adsense_publisher_id')
      .eq('id', orgId as string)
      .single()

    if (orgErr || !org) {
      return { status: 'error' as const, err_code: 'org_not_found', error: orgErr?.message ?? 'No org' }
    }

    if (!org.adsense_refresh_token_enc || !org.adsense_publisher_id) {
      return { status: 'ok' as const, ok: true, skipped: true, reason: 'no_token' }
    }

    try {
      const refreshToken = decrypt(org.adsense_refresh_token_enc as string, tokenKey)
      const accessToken = await refreshAccessToken(refreshToken, clientId, clientSecret)

      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const dateStr = yesterday.toISOString().split('T')[0]!
      const pubId = org.adsense_publisher_id as string

      const reportUrl = new URL(
        `https://adsense.googleapis.com/v2/accounts/${pubId}/reports:generate`,
      )
      reportUrl.searchParams.set('dateRange', 'CUSTOM')
      reportUrl.searchParams.set('startDate.year', dateStr.split('-')[0]!)
      reportUrl.searchParams.set('startDate.month', dateStr.split('-')[1]!)
      reportUrl.searchParams.set('startDate.day', dateStr.split('-')[2]!)
      reportUrl.searchParams.set('endDate.year', dateStr.split('-')[0]!)
      reportUrl.searchParams.set('endDate.month', dateStr.split('-')[1]!)
      reportUrl.searchParams.set('endDate.day', dateStr.split('-')[2]!)
      reportUrl.searchParams.append('dimensions', 'DATE')
      reportUrl.searchParams.append('dimensions', 'AD_UNIT_CODE')
      reportUrl.searchParams.append('metrics', 'IMPRESSIONS')
      reportUrl.searchParams.append('metrics', 'CLICKS')
      reportUrl.searchParams.append('metrics', 'ESTIMATED_EARNINGS')
      reportUrl.searchParams.append('metrics', 'PAGE_VIEWS')
      reportUrl.searchParams.append('metrics', 'AD_REQUESTS_COVERAGE')

      const reportRes = await fetch(reportUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const reportData = await reportRes.json() as {
        rows?: Array<{ cells: Array<{ value: string }> }>
      }

      if (!reportRes.ok) {
        throw new Error(`AdSense API error: ${JSON.stringify(reportData)}`)
      }

      const { data: siteData } = await supabase
        .from('sites')
        .select('id')
        .eq('slug', 'bythiagofigueiredo')
        .single()
      const siteId = siteData?.id as string | undefined

      let rowsUpserted = 0
      if (siteId && reportData.rows?.length) {
        const upsertRows = reportData.rows
          .map((row) => {
            const cells = row.cells ?? []
            const date = cells[0]?.value ?? dateStr
            const adUnitCode = cells[1]?.value ?? ''
            const impressions = parseInt(cells[2]?.value ?? '0', 10)
            const clicks = parseInt(cells[3]?.value ?? '0', 10)
            const earningsMicros = parseFloat(cells[4]?.value ?? '0')
            const pageViews = parseInt(cells[5]?.value ?? '0', 10)
            const fillRate = parseFloat(cells[6]?.value ?? '0') / 100

            const slotKey = adUnitToSlotKey(adUnitCode)

            return {
              site_id: siteId,
              slot_key: slotKey,
              date,
              source: 'adsense',
              impressions,
              clicks,
              earnings_usd_cents: Math.round(earningsMicros * 100),
              ad_requests: pageViews,
              fill_rate: fillRate,
              metadata: { adUnitCode, pubId, raw_earnings: earningsMicros },
            }
          })
          .filter((r) => r.slot_key)

        if (upsertRows.length > 0) {
          const { error: upsertErr } = await supabase
            .from('ad_revenue_daily')
            .upsert(upsertRows, { onConflict: 'site_id,slot_key,date,source' })

          if (upsertErr) {
            throw new Error(`Upsert failed: ${upsertErr.message}`)
          }
          rowsUpserted = upsertRows.length
        }
      }

      await supabase
        .from('organizations')
        .update({
          adsense_sync_status: 'ok',
          adsense_last_sync_at: new Date().toISOString(),
        })
        .eq('id', org.id as string)

      return { status: 'ok' as const, ok: true, rows_upserted: rowsUpserted, date: dateStr }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: JOB, org_id: org.id as string },
      })
      try {
        await supabase
          .from('organizations')
          .update({ adsense_sync_status: 'error' })
          .eq('id', org.id as string)
      } catch {
        /* best-effort */
      }

      return {
        status: 'error' as const,
        err_code: 'sync_failed',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}
