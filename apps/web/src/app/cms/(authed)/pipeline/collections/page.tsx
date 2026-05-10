import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { CollectionManager } from '../_components/collection-manager'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: rawCollections } = await supabase
    .from('content_collections')
    .select('id, code, name, type, description, content_pipeline_memberships(count, content_pipeline(stage))')
    .eq('site_id', siteId)
    .order('type')
    .order('position')

  interface MembershipRow { count?: number; content_pipeline: { stage: string } | null }
  const collections = (rawCollections ?? []).map((c) => {
    const memberships = (c.content_pipeline_memberships ?? []) as unknown as MembershipRow[]
    const memberCount = memberships.length
    const graduated = memberships.filter((m) => m.content_pipeline && ['published', 'scheduled', 'sent'].includes(m.content_pipeline.stage)).length
    const nextMember = memberships.find((m) => m.content_pipeline && !['published', 'scheduled', 'sent', 'idea'].includes(m.content_pipeline.stage))
    return {
      id: c.id, code: c.code, name: c.name ?? c.code, type: c.type,
      description: c.description ?? null, memberCount,
      progress: graduated,
      nextItem: nextMember ? { code: c.code, title: `${graduated + 1}/${memberCount}` } : null,
    }
  })

  return (
    <>
      <CmsTopbar title="Pipeline — Collections" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <CollectionManager collections={collections} />
      </div>
    </>
  )
}
