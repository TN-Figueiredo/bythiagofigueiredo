import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { scrapeOg } from '@/lib/social/og-scraper'
import { updatePipelineStep } from '@/lib/social/pipeline'
import { publishSocialPost } from '@/lib/social/workflows'
import type { SocialPost } from '@tn-figueiredo/social'
import { decrypt, getMasterKey } from '@tn-figueiredo/social/vault'
import type { OgScrapeResult } from '@/lib/social/types'

export async function POST(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { postId?: string }
    const { postId } = body

    if (!postId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
      return NextResponse.json({ ok: false, error: 'Valid postId required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json(
        { ok: false, error: 'Post not found' },
        { status: 404 },
      )
    }

    const postStatus = post.status as string
    if (postStatus === 'completed' || postStatus === 'cancelled' || postStatus === 'publishing') {
      return NextResponse.json(
        { ok: false, error: `Post already in status: ${postStatus}` },
        { status: 409 },
      )
    }

    // ----- Step 3: Platform Prepare -----
    await updatePipelineStep(supabase, postId, 'platform_prepare', 'in_progress')

    let scrapeResult: OgScrapeResult = { status: 'error', error: 'No Facebook connection' }
    let pageToken: string | null = null

    try {
      const { data: fbConnections } = await supabase
        .from('social_connections')
        .select('page_token_enc')
        .eq('site_id', post.site_id as string)
        .is('revoked_at', null)
        .eq('provider', 'facebook')

      if (fbConnections && fbConnections.length > 0 && fbConnections[0]!.page_token_enc) {
        const key = getMasterKey()
        pageToken = decrypt(fbConnections[0]!.page_token_enc as string, key)
      }
    } catch {
      // No Facebook connection — platform prepare will be skipped with warning
    }

    const content = post.content as { url?: string }
    const scrapeUrl = content?.url

    if (scrapeUrl && pageToken) {
      scrapeResult = await scrapeOg(scrapeUrl, pageToken)
    }

    if (scrapeResult.status === 'ok') {
      await updatePipelineStep(supabase, postId, 'platform_prepare', 'completed', {
        tags: scrapeResult.tags,
        latency_ms: scrapeResult.latency_ms,
        status: scrapeResult.http_status,
      })
    } else {
      await updatePipelineStep(supabase, postId, 'platform_prepare', 'warning', {
        status: scrapeResult.status,
        error: scrapeResult.error,
      })
    }

    // ----- Step 4: Deliver -----
    await updatePipelineStep(supabase, postId, 'deliver', 'in_progress')

    try {
      const socialPost = post as unknown as SocialPost
      await publishSocialPost(socialPost)
      await updatePipelineStep(supabase, postId, 'deliver', 'completed')
      return NextResponse.json({ ok: true })
    } catch (deliverErr) {
      const errorMsg = deliverErr instanceof Error ? deliverErr.message : 'Unknown delivery error'
      await updatePipelineStep(supabase, postId, 'deliver', 'failed', {
        error: errorMsg,
      })
      Sentry.captureException(deliverErr, {
        tags: { component: 'social-pipeline-run', step: 'deliver' },
        extra: { postId },
      })
      return NextResponse.json({ ok: false, error: errorMsg })
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'social-pipeline-run' },
    })
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
