import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import * as Sentry from '@sentry/nextjs'

const JOB = 'ab-draft-cleanup'
const LOCK_KEY = 'cron:ab-draft-cleanup'
const ARCHIVE_AFTER_HOURS = 24
const HARD_DELETE_AFTER_DAYS = 30
const BATCH_SIZE = 50

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    let archived = 0
    let hardDeleted = 0

    const archiveCutoff = new Date()
    archiveCutoff.setHours(archiveCutoff.getHours() - ARCHIVE_AFTER_HOURS)

    const { data: staleDrafts, error: draftErr } = await supabase
      .from('ab_tests')
      .select('id')
      .eq('status', 'draft')
      .lt('updated_at', archiveCutoff.toISOString())
      .limit(BATCH_SIZE)

    if (draftErr) {
      Sentry.captureException(draftErr, { tags: { component: JOB } })
      await recordCronFailure('ab-draft-cleanup', draftErr.message)
      return { status: 'error' as const, error: draftErr.message }
    }

    if (staleDrafts && staleDrafts.length > 0) {
      const ids = staleDrafts.map(d => d.id as string)
      const { error: updateErr } = await supabase
        .from('ab_tests')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('id', ids)

      if (updateErr) {
        Sentry.captureException(updateErr, { tags: { component: JOB } })
        await recordCronFailure('ab-draft-cleanup', updateErr.message)
        return { status: 'error' as const, error: updateErr.message }
      }
      archived = ids.length
    }

    const hardDeleteCutoff = new Date()
    hardDeleteCutoff.setDate(hardDeleteCutoff.getDate() - HARD_DELETE_AFTER_DAYS)

    const { data: oldArchived, error: oldErr } = await supabase
      .from('ab_tests')
      .select('id')
      .eq('status', 'archived')
      .lt('updated_at', hardDeleteCutoff.toISOString())
      .limit(BATCH_SIZE)

    if (oldErr) {
      Sentry.captureException(oldErr, { tags: { component: JOB } })
      await recordCronFailure('ab-draft-cleanup', oldErr.message)
      return { status: 'error' as const, error: oldErr.message }
    }

    if (oldArchived && oldArchived.length > 0) {
      const ids = oldArchived.map(d => d.id as string)

      // Clean up Vercel Blob storage for variants with blob_url
      const { data: blobVariants } = await supabase
        .from('ab_test_variants')
        .select('blob_url')
        .in('test_id', ids)
        .not('blob_url', 'is', null)

      if (blobVariants && blobVariants.length > 0) {
        const { del } = await import('@vercel/blob')
        const urls = blobVariants
          .map(v => v.blob_url as string)
          .filter(Boolean)
        if (urls.length > 0) {
          try {
            await del(urls)
          } catch (err) {
            Sentry.captureException(err, { tags: { component: JOB, phase: 'blob-cleanup' } })
            // Continue with DB deletion even if blob cleanup fails
          }
        }
      }

      const { error: deleteErr } = await supabase
        .from('ab_tests')
        .delete()
        .in('id', ids)

      if (deleteErr) {
        Sentry.captureException(deleteErr, { tags: { component: JOB } })
      } else {
        hardDeleted = ids.length
      }
    }

    await recordCronSuccess('ab-draft-cleanup', 'info')
    return { status: 'ok' as const, ok: true, archived, hardDeleted }
  })
}
