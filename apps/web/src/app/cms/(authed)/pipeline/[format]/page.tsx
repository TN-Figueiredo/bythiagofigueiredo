import { notFound, redirect } from 'next/navigation'
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
  if (format === 'blog_post') redirect('/cms/blog')

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const itemsRes = await supabase
    .from('content_pipeline')
    .select(`
      id, code, title_pt, title_en, stage, priority, language, tags,
      production_checklist, version, sort_order, format, hook, body_content, updated_at,
      youtube_video_id, blog_post_id, newsletter_edition_id, campaign_id, social_post_id,
      is_archived, format_metadata, cover_image_url, blog_posts(status)
    `)
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })

  const boardItems = (itemsRes.data ?? []).map((item) => {
    const score = computeValidationScore({
      title_pt: item.title_pt, title_en: item.title_en, hook: item.hook, synopsis: null,
      body_content: item.body_content, tags: item.tags ?? [], production_checklist: item.production_checklist ?? [],
      format_metadata: item.format_metadata ?? {}, format: item.format as Format,
    })

    return {
      id: item.id, code: item.code, title_pt: item.title_pt, title_en: item.title_en,
      format: item.format, stage: item.stage, language: item.language, priority: item.priority,
      hook: item.hook, body_content: item.body_content, tags: item.tags ?? [],
      production_checklist: item.production_checklist ?? [], updated_at: item.updated_at,
      youtube_video_id: item.youtube_video_id, blog_post_id: item.blog_post_id,
      newsletter_edition_id: item.newsletter_edition_id, campaign_id: item.campaign_id,
      social_post_id: (item as Record<string, unknown>).social_post_id as string | null,
      is_archived: item.is_archived, validation_score: score.overall,
      dependencies: [],
      // Supabase client untyped (no generated DB types); fields are in .select() above
      linked_post_status: (item as unknown as { blog_posts?: { status: string } | null }).blog_posts?.status ?? null,
      sort_order: (item as unknown as { sort_order: number }).sort_order ?? 0,
      version: item.version ?? 1,
      cover_image_url: (item as unknown as { cover_image_url: string | null }).cover_image_url ?? null,
    }
  })

  const labels: Record<string, string> = { video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign' }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineBoard format={format as Format} items={boardItems} />
      </div>
    </>
  )
}
