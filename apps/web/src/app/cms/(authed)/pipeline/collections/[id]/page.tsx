import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { CollectionDetail } from '../../_components/collection-detail'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import type { GemCardItem } from '../../_components/gem-card'

export const dynamic = 'force-dynamic'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: collection } = await supabase
    .from('content_collections')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!collection) notFound()

  const { data: rawMembers } = await supabase
    .from('content_pipeline_memberships')
    .select('position, role, content_pipeline(id, code, title_pt, title_en, format, stage, priority, tags, language, hook, body_content, updated_at, youtube_video_id, blog_post_id, newsletter_edition_id, campaign_id, is_archived, validation_score, production_checklist, content_pipeline_dependencies(dependency_type, depends_on_pipeline:content_pipeline!content_pipeline_dependencies_depends_on_id_fkey(code)))')
    .eq('collection_id', id)
    .order('position')

  const members = (rawMembers ?? [])
    .map((m: Record<string, unknown>) => {
      const raw = Array.isArray(m.content_pipeline) ? m.content_pipeline[0] ?? null : m.content_pipeline ?? null
      if (!raw) return null
      const item = raw as Record<string, unknown>
      return {
        id: item.id as string,
        code: item.code as string,
        title_pt: item.title_pt as string | null,
        title_en: item.title_en as string | null,
        format: item.format as string,
        stage: item.stage as string,
        language: (item.language as string) ?? 'pt-br',
        priority: (item.priority as number) ?? 0,
        hook: item.hook as string | null,
        body_content: item.body_content as string | null,
        tags: (item.tags as string[]) ?? [],
        production_checklist: (item.production_checklist as Array<{ label: string; done: boolean }>) ?? [],
        updated_at: item.updated_at as string,
        youtube_video_id: item.youtube_video_id as string | null,
        blog_post_id: item.blog_post_id as string | null,
        newsletter_edition_id: item.newsletter_edition_id as string | null,
        campaign_id: item.campaign_id as string | null,
        is_archived: (item.is_archived as boolean) ?? false,
        validation_score: (item.validation_score as number) ?? 0,
        dependencies: (item.content_pipeline_dependencies as Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>) ?? [],
        collection_code: collection.code,
      }
    })
    .filter((x): x is GemCardItem => x !== null)

  return (
    <>
      <CmsTopbar title={`Collection — ${collection.name || collection.code}`} />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <CollectionDetail collection={collection} members={members} />
      </div>
    </>
  )
}
