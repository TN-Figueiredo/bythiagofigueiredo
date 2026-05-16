import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineItemDetail } from '../../_components/pipeline-item-detail'
import { computeValidationScore } from '@/lib/pipeline/validation'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { Format } from '@/lib/pipeline/schemas'

export const dynamic = 'force-dynamic'

export default async function PipelineItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const search = await searchParams
  const fromBlog = search.from === 'blog'
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemRes, historyRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])

  if (itemRes.error || !itemRes.data) notFound()
  const item = itemRes.data

  // Load linked blog post info if present
  let linkedPost: { id: string; title: string; status: string; locales: string[] } | null = null
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

  const dependencies = (depsRes.data ?? []).map((d: Record<string, unknown>) => ({
    dependency_type: d.dependency_type as string,
    depends_on_pipeline: (Array.isArray(d.depends_on_pipeline) ? d.depends_on_pipeline[0] : d.depends_on_pipeline) as { code: string },
  }))

  const score = computeValidationScore({
    title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: item.synopsis,
    body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {}, format: item.format as Format,
  })

  const enrichedItem = { ...item, validation_score: score.overall, site_id: siteId, linked_post: linkedPost }

  return (
    <>
      <CmsTopbar title={`${fromBlog ? 'Blog > ' : ''}Pipeline: ${item.title_pt || item.title_en || item.code}`} />
      <div className="gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineItemDetail item={enrichedItem} history={historyRes.data ?? []} dependencies={dependencies} />
      </div>
    </>
  )
}
