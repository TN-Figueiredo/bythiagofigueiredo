import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { SettingsConnected } from './settings-connected'

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()
  const [siteRes, typesRes, cadenceRes] = await Promise.all([
    supabase.from('sites').select('*').eq('id', siteId).single(),
    supabase
      .from('newsletter_types')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order'),
    supabase
      .from('blog_cadence')
      .select('*')
      .eq('site_id', siteId)
      .order('locale'),
  ])

  const seoFlags = {
    jsonLd: process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED !== 'false',
    dynamicOg: process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false',
    extendedSchemas:
      process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED !== 'false',
    aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
  }

  return (
    <div>
      <CmsTopbar title="Settings" />
      <SettingsConnected
        site={siteRes.data}
        newsletterTypes={typesRes.data ?? []}
        blogCadence={cadenceRes.data ?? []}
        initialSection={params.section ?? 'branding'}
        seoFlags={seoFlags}
        readOnly={readOnly}
      />
    </div>
  )
}
