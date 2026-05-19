import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

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
