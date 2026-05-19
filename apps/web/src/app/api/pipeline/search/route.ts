import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, pipelineError } from '@/lib/pipeline/helpers'
import { sanitizeForLike, sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) return pipelineError('VALIDATION_ERROR', 'Query must be at least 2 characters', 400, auth)

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

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      pipeline: pipelineItems ?? [],
      blog_posts: blogPosts ?? [],
      newsletters: newsletters ?? [],
    },
    meta: { query: q, limit },
  }, { headers })
}
