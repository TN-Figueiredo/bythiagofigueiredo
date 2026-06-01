import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { computeValidationScore } from './validation'
import type { Format } from './schemas'

interface LinkedPost {
  id: string
  title: string
  status: string
  locales: string[]
}

interface Dependency {
  dependency_type: string
  depends_on_pipeline: { code: string }
}

export async function loadPipelineItemDetail(id: string, siteId: string) {
  const supabase = getSupabaseServiceClient()

  const [itemRes, historyRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('id, site_id, code, stage, format, priority, status, language, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata, sections, blog_post_id, scheduled_at, is_archived, version, created_at, updated_at').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('id, pipeline_id, event_type, from_value, to_value, changed_by, changed_at').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])

  if (itemRes.error || !itemRes.data) notFound()
  const item = itemRes.data

  let linkedPost: LinkedPost | null = null
  if (item.blog_post_id) {
    const [postRes, translationsRes] = await Promise.all([
      supabase.from('blog_posts').select('id, status').eq('id', item.blog_post_id).single(),
      supabase.from('blog_translations').select('locale, title').eq('post_id', item.blog_post_id),
    ])
    if (postRes.data) {
      const translations = translationsRes.data ?? []
      const title = translations[0]?.title ?? '(sem título)'
      const locales = translations.map((t: { locale: string; title: string }) => t.locale)
      linkedPost = { id: postRes.data.id, title, status: postRes.data.status, locales }
    }
  }

  const dependencies: Dependency[] = (depsRes.data ?? [])
    .map((d: Record<string, unknown>) => ({
      dependency_type: d.dependency_type as string,
      depends_on_pipeline: (Array.isArray(d.depends_on_pipeline) ? d.depends_on_pipeline[0] : d.depends_on_pipeline) as { code: string } | null,
    }))
    .filter((d): d is Dependency => d.depends_on_pipeline !== null)

  const score = computeValidationScore({
    title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: item.synopsis,
    body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {}, format: item.format as Format,
    sections: item.sections ?? null,
    language: item.language ?? undefined,
  })

  const enrichedItem = { ...item, validation_score: score.overall, site_id: siteId, linked_post: linkedPost }

  return { item: enrichedItem, history: historyRes.data ?? [], dependencies }
}
