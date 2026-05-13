import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { publishSocialPost } from '@/lib/social/workflows'
import type { SocialPost } from '@tn-figueiredo/social'

// Vercel Cron: { "path": "/api/cron/social-publish", "schedule": "* * * * *" }

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCK_KEY = 'cron:social-publish'
const JOB = 'social-publish'
const BATCH_LIMIT = 10

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()
  const nowIso = new Date().toISOString()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: posts, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_LIMIT)

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`)
    }

    if (!posts || posts.length === 0) {
      return { status: 'ok' as const, processed: 0 }
    }

    let processed = 0
    const errors: string[] = []

    for (const post of posts) {
      try {
        await publishSocialPost(post as unknown as SocialPost)
        processed++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`post ${post.id}: ${message}`)
      }
    }

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: errors.length > 0 ? 'error' : 'ok',
        items_processed: processed,
        error: errors.length > 0 ? errors.join('; ') : null,
      })
    } catch {
      /* best-effort */
    }

    if (errors.length > 0) {
      return { status: 'error' as const, processed, errors }
    }

    return { status: 'ok' as const, processed }
  })
}
