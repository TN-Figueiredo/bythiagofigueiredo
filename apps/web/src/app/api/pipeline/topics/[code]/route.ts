import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const supabase = getSupabaseServiceClient()

  const { data: pipelineItems } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, priority, tags, updated_at')
    .eq('site_id', auth.siteId)
    .contains('tags', [code])
    .eq('is_archived', false)
    .order('priority', { ascending: false })

  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, status, category')
    .eq('site_id', auth.siteId)
    .eq('category', code)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      topic: code,
      pipeline_items: pipelineItems ?? [],
      blog_posts: blogPosts ?? [],
    },
  }, { headers })
}
