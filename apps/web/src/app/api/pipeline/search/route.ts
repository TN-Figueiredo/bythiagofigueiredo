import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { sanitizeForLike, sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters' } }, { status: 400 })

  const trimmedQ = q.trim().slice(0, 200)
  const safeQ = sanitizeForFilter(sanitizeForLike(trimmedQ))

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 50)
  const supabase = getSupabaseServiceClient()

  const { data: pipelineItems } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, priority, tags, updated_at')
    .eq('site_id', auth.siteId)
    .textSearch('search_vector', sanitizeForTsquery(trimmedQ), { type: 'plain' })
    .limit(limit)

  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, status, category, locale')
    .eq('site_id', auth.siteId)
    .or(`title.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`)
    .limit(10)

  const { data: newsletters } = await supabase
    .from('newsletter_editions')
    .select('id, subject, status')
    .eq('site_id', auth.siteId)
    .ilike('subject', `%${safeQ}%`)
    .limit(10)

  const { data: collections } = await supabase
    .from('content_collections')
    .select('id, code, name, type')
    .eq('site_id', auth.siteId)
    .or(`name.ilike.%${safeQ}%,code.ilike.%${safeQ}%`)
    .limit(10)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      pipeline: pipelineItems ?? [],
      blog_posts: blogPosts ?? [],
      newsletters: newsletters ?? [],
      collections: collections ?? [],
    },
    meta: { query: q, limit },
  }, { headers })
}
