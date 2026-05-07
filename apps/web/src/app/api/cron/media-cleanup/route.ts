import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'

const JOB = 'media-cleanup'
const LOCK_KEY = 'cron:media-cleanup'
const SOFT_DELETE_GRACE_DAYS = 7
const HARD_DELETE_AFTER_DAYS = 30
const HARD_DELETE_BATCH_SIZE = 50

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    let softDeleted = 0
    let hardDeleted = 0

    const { data: orphanIds, error: orphanErr } = await supabase
      .rpc('find_orphan_media_assets', { p_grace_days: SOFT_DELETE_GRACE_DAYS })

    if (orphanErr) {
      Sentry.captureException(orphanErr, {
        tags: { media: 'true', component: 'media-cleanup' },
      })
      return { status: 'error' as const, error: orphanErr.message }
    }

    const ids = (orphanIds ?? []) as string[]
    if (ids.length > 0) {
      const { error: updateErr } = await supabase
        .from('media_assets')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)

      if (updateErr) {
        Sentry.captureException(updateErr, {
          tags: { media: 'true', component: 'media-cleanup' },
        })
        return { status: 'error' as const, error: updateErr.message }
      }
      softDeleted = ids.length
    }

    const hardCutoff = new Date()
    hardCutoff.setDate(hardCutoff.getDate() - HARD_DELETE_AFTER_DAYS)

    const { data: stale, error: staleErr } = await supabase
      .from('media_assets')
      .select('id, blob_url')
      .lt('deleted_at', hardCutoff.toISOString())
      .limit(HARD_DELETE_BATCH_SIZE)

    if (staleErr) {
      Sentry.captureException(staleErr, {
        tags: { media: 'true', component: 'media-cleanup' },
      })
      return { status: 'error' as const, error: staleErr.message }
    }

    for (const asset of stale ?? []) {
      try {
        await del(asset.blob_url)
        await supabase.from('media_assets').delete().eq('id', asset.id)
        hardDeleted++
      } catch (err) {
        Sentry.captureException(err, {
          tags: { media: 'true', component: 'media-cleanup' },
        })
      }
    }

    return { status: 'ok' as const, ok: true, softDeleted, hardDeleted }
  })
}
