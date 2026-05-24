import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { ResearchImportSchema } from '@/lib/pipeline/research-schemas'
import { validateTopicSlugDepth, resolveOrCreateTopics } from '@/lib/pipeline/research-topics'

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchImportSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const results: Array<{ id?: string; title: string; ok: boolean; error?: string }> = []
  const topicCache = new Map<string, string>()

  for (const item of parsed.data.items) {
    if (!validateTopicSlugDepth(item.topic_slug)) {
      results.push({ title: item.title, ok: false, error: 'Max 3 levels' })
      continue
    }

    const topicResult = await resolveOrCreateTopics(supabase, auth.siteId, item.topic_slug, topicCache)
    if ('error' in topicResult) {
      results.push({ title: item.title, ok: false, error: topicResult.error })
      continue
    }

    const { data: created, error } = await supabase
      .from('research_items')
      .upsert(
        {
          site_id: auth.siteId,
          topic_id: topicResult.topicId,
          title: item.title,
          content_md: item.content_md,
          content_json: null,
          summary: item.summary ?? null,
          sources: item.sources,
          status: 'new',
        },
        { onConflict: 'site_id,topic_id,title' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('[research/import]', error)
      results.push({ title: item.title, ok: false, error: 'Failed to save item' })
    } else {
      results.push({ id: created!.id, title: item.title, ok: true })
    }
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      results,
      success_count: results.filter((r) => r.ok).length,
      failure_count: results.filter((r) => !r.ok).length,
    },
  }, { headers })
}
