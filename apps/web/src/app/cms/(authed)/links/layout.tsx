import type { Metadata } from 'next'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function generateMetadata(): Promise<Metadata> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('site_name')
    .eq('id', siteId)
    .single()

  const siteName = data?.site_name ?? 'CMS'

  return {
    title: {
      template: `%s · Links — ${siteName}`,
      default: `Links — ${siteName}`,
    },
  }
}

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
