import { NextRequest, NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

interface CompleteBody {
  videoId: string
  postId?: string
}

export async function POST(req: NextRequest) {
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as CompleteBody

  if (!body.videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  if (body.postId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.postId)) {
    return NextResponse.json({ error: 'Invalid postId' }, { status: 400 })
  }

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
      return NextResponse.json(
        { error: `Failed to update post: ${error.message}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, videoId: body.videoId })
}
