import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { publishSocialPost } from '@/lib/social/workflows'
import { scrapeOg } from '@/lib/social/og-scraper'
import { updatePipelineStep } from '@/lib/social/pipeline'
import type { SocialPost } from '@tn-figueiredo/social'
import type { PipelineStep } from '@/lib/social/types'

// Vercel Cron: { "path": "/api/cron/social-publish", "schedule": "* * * * *" }

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCK_KEY = 'cron:social-publish'
const JOB = 'social-publish'
const BATCH_LIMIT = 10
const PREPARE_WINDOW_MS = 5 * 60 * 1000

function getStepStatus(
  steps: PipelineStep[] | null | undefined,
  stepName: string,
): string | undefined {
  if (!steps || !Array.isArray(steps)) return undefined
  const step = steps.find((s) => s.step === stepName)
  return step?.status
}

function needsPlatformPrepare(post: Record<string, unknown>): boolean {
  const steps = post.pipeline_steps as PipelineStep[] | null
  const ogStatus = getStepStatus(steps, 'platform_prepare')
  return ogStatus === 'pending' || ogStatus === undefined
}

function isWithinScrapeWindow(scheduledAt: string): boolean {
  const scheduledTime = new Date(scheduledAt).getTime()
  const now = Date.now()
  return scheduledTime - now <= PREPARE_WINDOW_MS && scheduledTime > now
}

function isReadyForDelivery(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() <= Date.now()
}

interface BatchResult {
  status: 'ok' | 'error'
  processed: number
  errors?: string[]
}

async function processBatch(
  supabase: SupabaseClient,
  posts: Record<string, unknown>[],
): Promise<BatchResult> {
  let processed = 0
  const errors: string[] = []

  for (const post of posts) {
    const scheduledAt = post.scheduled_at as string

    try {
      if (needsPlatformPrepare(post) && isWithinScrapeWindow(scheduledAt)) {
        await updatePipelineStep(supabase, post.id as string, 'platform_prepare', 'in_progress')

        const contentUrl = (post.content as Record<string, unknown>)?.url as string | undefined

        if (contentUrl) {
          const { data: fbConn } = await supabase
            .from('social_connections')
            .select('page_token_enc')
            .eq('site_id', post.site_id)
            .eq('provider', 'facebook')
            .is('revoked_at', null)
            .limit(1)
            .single()

          let pageToken: string | undefined
          if (fbConn?.page_token_enc) {
            const { decrypt, getMasterKey } = await import('@tn-figueiredo/social/vault')
            pageToken = decrypt(fbConn.page_token_enc as string, getMasterKey())
          }

          if (pageToken) {
            const scrapeResult = await scrapeOg(contentUrl, pageToken)
            const scrapeData = scrapeResult as unknown as Record<string, unknown>

            if (scrapeResult.status === 'ok') {
              await updatePipelineStep(supabase, post.id as string, 'platform_prepare', 'completed', scrapeData)
            } else {
              await updatePipelineStep(supabase, post.id as string, 'platform_prepare', 'warning', scrapeData)
            }
          } else {
            await updatePipelineStep(supabase, post.id as string, 'platform_prepare', 'warning', {
              status: 'skipped',
              error: 'no_facebook_token',
            })
          }
        } else {
          await updatePipelineStep(supabase, post.id as string, 'platform_prepare', 'warning', {
            status: 'skipped',
            error: 'no_content_url',
          })
        }
      }

      if (isReadyForDelivery(scheduledAt)) {
        await updatePipelineStep(supabase, post.id as string, 'deliver', 'in_progress')
        await publishSocialPost(post as unknown as SocialPost)
        await updatePipelineStep(supabase, post.id as string, 'deliver', 'completed')
        processed++
      }
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
    return { status: 'error', processed, errors }
  }

  return { status: 'ok', processed }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()
  const fiveMinFromNow = new Date(
    Date.now() + PREPARE_WINDOW_MS,
  ).toISOString()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // Fair scheduling: fetch distinct sites with pending posts, then round-robin
    const { data: posts, error: fetchError } = await supabase
      .rpc('social_publish_fair_batch', {
        window_end: fiveMinFromNow,
        batch_size: BATCH_LIMIT,
      })

    // Fallback to simple query if RPC doesn't exist yet
    if (fetchError?.code === '42883') {
      const { data: fallbackPosts, error: fallbackError } = await supabase
        .from('social_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', fiveMinFromNow)
        .order('scheduled_at', { ascending: true })
        .limit(BATCH_LIMIT)

      if (fallbackError) {
        throw new Error(`Failed to fetch scheduled posts: ${fallbackError.message}`)
      }

      if (!fallbackPosts || fallbackPosts.length === 0) {
        return { status: 'ok' as const, processed: 0 }
      }

      return processBatch(supabase, fallbackPosts as unknown as Record<string, unknown>[])
    }

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`)
    }

    if (!posts || posts.length === 0) {
      return { status: 'ok' as const, processed: 0 }
    }

    return processBatch(supabase, posts as unknown as Record<string, unknown>[])
  })
}
