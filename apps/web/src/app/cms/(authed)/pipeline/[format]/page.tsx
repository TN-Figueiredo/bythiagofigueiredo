import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineBoard } from '../_components/pipeline-board'

export const dynamic = 'force-dynamic'

export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select(`
      id, code, title_pt, title_en, stage, priority, language, tags,
      production_checklist, version, format,
      content_pipeline_memberships(role, content_collections(code, name))
    `)
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('is_archived', false)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })

  const boardItems = (items ?? []).map((item) => {
    const memberships = (item.content_pipeline_memberships ?? []) as Array<Record<string, unknown>>
    let collectionCode: string | null = null
    let collectionName: string | null = null
    let membershipRole: string | null = null

    for (const m of memberships) {
      const col = Array.isArray(m.content_collections) ? m.content_collections[0] : m.content_collections
      if (col && typeof col === 'object' && 'code' in col) {
        collectionCode = col.code as string
        collectionName = col.name as string
        membershipRole = (m.role as string) ?? null
        break
      }
    }

    return {
      id: item.id as string,
      code: item.code as string,
      title_pt: item.title_pt as string | null,
      title_en: item.title_en as string | null,
      stage: item.stage as string,
      priority: item.priority as number,
      language: item.language as string,
      tags: item.tags as string[],
      production_checklist: item.production_checklist as Array<{ label: string; done: boolean }>,
      version: item.version as number,
      format: item.format as string,
      collectionCode,
      collectionName,
      membershipRole,
    }
  })

  const labels: Record<string, string> = {
    video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
  }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4">
        <PipelineBoard format={format as Format} items={boardItems} />
      </div>
    </>
  )
}
