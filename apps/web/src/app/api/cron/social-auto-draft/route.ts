import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { createInitialPipelineSteps } from '@/lib/social/pipeline'
import * as Sentry from '@sentry/nextjs'

// Vercel Cron: { "path": "/api/cron/social-auto-draft", "schedule": "*/30 * * * *" }

export const runtime = 'nodejs'
export const maxDuration = 60

const LOCK_KEY = 'cron:social-auto-draft'
const JOB = 'social-auto-draft'

/**
 * Scans recently-published blog posts and creates social draft posts
 * for any that don't already have an active social post.
 *
 * Uses the DB unique index `idx_social_posts_active_per_content` as
 * a final guard against duplicates (ON CONFLICT DO NOTHING).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // 1. Fetch blog posts published in the last 24h
    const { data: blogPosts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, site_id, title, slug')
      .gte('published_at', cutoff)
      .eq('status', 'published')

    if (fetchError) {
      throw new Error(`Failed to fetch blog posts: ${fetchError.message}`)
    }

    if (!blogPosts || blogPosts.length === 0) {
      return { status: 'ok' as const, draftsCreated: 0 }
    }

    // 2. Check which already have an active social post
    const contentIds = blogPosts.map((p) => p.id as string)
    const { data: existingSocial } = await supabase
      .from('social_posts')
      .select('source_content_id')
      .eq('source_content_type', 'blog')
      .in('source_content_id', contentIds)
      .in('status', ['draft', 'scheduled', 'publishing', 'completed'])

    const existingContentIds = new Set(
      (existingSocial ?? []).map((p) => p.source_content_id as string),
    )

    // 3. Create draft social posts for new blog posts
    let draftsCreated = 0
    const errors: string[] = []

    for (const post of blogPosts) {
      const postId = post.id as string
      if (existingContentIds.has(postId)) continue

      try {
        const pipelineSteps = createInitialPipelineSteps()
        // Override first step with auto_draft context
        pipelineSteps[0] = {
          step: 'post_created',
          status: 'completed',
          at: new Date().toISOString(),
          data: {
            trigger: 'blog_published',
            source_title: post.title as string,
          },
        }

        const { error: insertError } = await supabase
          .from('social_posts')
          .insert({
            site_id: post.site_id as string,
            created_by: '00000000-0000-0000-0000-000000000000',
            type: 'link',
            status: 'draft',
            content: {
              title: post.title as string,
            },
            origin: 'auto',
            source_content_type: 'blog',
            source_content_id: postId,
            idempotency_key: `auto-blog-${postId}`,
            user_timezone: 'America/Sao_Paulo',
            pipeline_steps: pipelineSteps,
          })

        // Unique index violation = already exists, skip silently
        if (insertError?.code === '23505') continue

        if (insertError) {
          errors.push(`post ${postId}: ${insertError.message}`)
          continue
        }

        draftsCreated++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`post ${postId}: ${message}`)
        Sentry.captureException(err, {
          tags: { component: 'social-auto-draft-cron' },
          extra: { postId },
        })
      }
    }

    // 4. Log cron run
    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: errors.length > 0 ? 'error' : 'ok',
        items_processed: draftsCreated,
        error: errors.length > 0 ? errors.join('; ') : null,
      })
    } catch {
      /* best-effort */
    }

    return {
      status: 'ok' as const,
      draftsCreated,
      errors: errors.length > 0 ? errors : undefined,
    }
  })
}
