import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { SettingsConnected } from './settings-connected'

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const [siteRes, typesRes, cadenceRes] = await Promise.all([
    supabase.from('sites').select('*').eq('id', siteId).single(),
    supabase.from('newsletter_types').select('*').eq('site_id', siteId).order('sort_order'),
    supabase.from('blog_cadence').select('*').eq('site_id', siteId).order('locale'),
  ])

  return (
    <div>
      <CmsTopbar title="Settings" />
      <SettingsConnected
        site={siteRes.data}
        newsletterTypes={typesRes.data ?? []}
        blogCadence={cadenceRes.data ?? []}
        initialSection={params.section ?? 'branding'}
      />
    </div>
  )
}
