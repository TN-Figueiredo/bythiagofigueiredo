import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineBoard } from '../_components/pipeline-board'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { computeValidationScore } from '@/lib/pipeline/validation'

export const dynamic = 'force-dynamic'

export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [itemsRes, collectionsRes] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select(`
        id, code, title_pt, title_en, stage, priority, language, tags,
        production_checklist, version, format, hook, body_content, updated_at,
        youtube_video_id, blog_post_id, newsletter_edition_id, campaign_id,
        is_archived, format_metadata,
        content_pipeline_memberships(role, content_collections(code, name))
      `)
      .eq('site_id', siteId)
      .eq('format', format)
      .eq('is_archived', false)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('content_collections')
      .select('code, name')
      .eq('site_id', siteId)
      .eq('type', 'playlist'),
  ])

  const boardItems = (itemsRes.data ?? []).map((item) => {
    const memberships = (item.content_pipeline_memberships ?? []) as unknown as Array<{ role: string | null; content_collections: { code: string; name: string } | { code: string; name: string }[] | null }>
    let collectionCode: string | null = null
    for (const m of memberships) {
      const col = Array.isArray(m.content_collections) ? m.content_collections[0] : m.content_collections
      if (col?.code) { collectionCode = col.code; break }
    }

    const score = computeValidationScore({
      title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: null,
      body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
      format_metadata: item.format_metadata ?? {}, memberships_count: memberships.length, format: item.format as Format,
    })

    return {
      id: item.id, code: item.code, title_pt: item.title_pt, title_en: item.title_en,
      format: item.format, stage: item.stage, language: item.language, priority: item.priority,
      hook: item.hook, body_content: item.body_content, tags: item.tags ?? [],
      production_checklist: item.production_checklist ?? [], updated_at: item.updated_at,
      youtube_video_id: item.youtube_video_id, blog_post_id: item.blog_post_id,
      newsletter_edition_id: item.newsletter_edition_id, campaign_id: item.campaign_id,
      is_archived: item.is_archived, validation_score: score.overall,
      dependencies: [], collection_code: collectionCode,
    }
  })

  const collections = (collectionsRes.data ?? []).map((c) => ({ code: c.code, name: c.name ?? c.code }))
  const labels: Record<string, string> = { video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign' }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineBoard format={format as Format} items={boardItems} collections={collections} />
      </div>
    </>
  )
}
