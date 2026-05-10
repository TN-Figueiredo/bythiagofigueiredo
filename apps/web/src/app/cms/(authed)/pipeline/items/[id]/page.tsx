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

export default async function PipelineItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemRes, historyRes, membershipsRes, depsRes] = await Promise.all([
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase.from('content_pipeline_memberships').select('collection_id, content_collections(id, code, name, type)').eq('pipeline_id', id),
    supabase.from('content_pipeline_dependencies').select('dependency_type, depends_on_pipeline:depends_on_id(code)').eq('pipeline_id', id),
  ])

  if (itemRes.error || !itemRes.data) notFound()
  const item = itemRes.data

  interface MembershipWithCollection { content_collections: { id: string; code: string; name: string; type: string } | null }
  const collections = ((membershipsRes.data ?? []) as unknown as MembershipWithCollection[]).map((m) => m.content_collections).filter((c): c is NonNullable<typeof c> => c !== null)
  const dependencies = (depsRes.data ?? []).map((d: Record<string, unknown>) => ({
    dependency_type: d.dependency_type as string,
    depends_on_pipeline: (Array.isArray(d.depends_on_pipeline) ? d.depends_on_pipeline[0] : d.depends_on_pipeline) as { code: string },
  }))

  const score = computeValidationScore({
    title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: item.synopsis,
    body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
    format_metadata: item.format_metadata ?? {}, memberships_count: collections.length, format: item.format as Format,
  })

  const enrichedItem = { ...item, validation_score: score.overall }

  return (
    <>
      <CmsTopbar title={item.title_pt || item.title_en || item.code} />
      <div className="gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineItemDetail item={enrichedItem} collections={collections} history={historyRes.data ?? []} dependencies={dependencies} />
      </div>
    </>
  )
}
