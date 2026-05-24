import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const CompleteBodySchema = z.object({
  videoId: z.string().min(1),
  postId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = CompleteBodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }
  const body = parsed.data

  if (body.postId) {
    const supabase = getSupabaseServiceClient()

    const { data: post } = await supabase
      .from('social_posts')
      .select('id, content')
      .eq('id', body.postId)
      .eq('site_id', siteId)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const content = (post.content ?? {}) as Record<string, unknown>
    content.video_id = body.videoId

    const { error } = await supabase
      .from('social_posts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', body.postId)

    if (error) {
      console.error('[youtube/complete]', error)
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, videoId: body.videoId })
}
