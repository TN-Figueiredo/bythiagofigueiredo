import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import {
  SiteSwitcherProvider,
  type AccessibleSite,
} from '@tn-figueiredo/admin/site-switcher'
import { CmsSiteSwitcherSlot } from '@/components/cms/site-switcher-provider'
import { CmsShell } from '@tn-figueiredo/cms-ui/client'
import { CmsAdminProvider } from '@tn-figueiredo/cms-admin/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const user = await requireUser(supabase)
  await requireArea('cms')

  const { data: sitesData } = await supabase.rpc('user_accessible_sites')
  const rawSites = (sitesData ?? []) as Array<{ site_id: string; site_name: string; site_slug: string; primary_domain: string; user_role: string }>
  const sites = rawSites.map((s) => ({
    id: s.site_id,
    slug: s.site_slug,
    name: s.site_name,
    primary_domain: s.primary_domain,
    logo_url: null,
  })) as AccessibleSite[]
  const currentSiteId = rawSites[0]?.site_id ?? ''
  const currentSite = rawSites.find((s) => s.site_id === currentSiteId)
  const userDisplayName = user.email ?? 'User'
  const userRole = currentSite?.user_role ?? 'reporter'

  const svc = getSupabaseServiceClient()
  const [draftsRes, subsRes, pendingContactsRes] = await Promise.all([
    svc.from('blog_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).eq('status', 'draft'),
    svc.from('newsletter_subscriptions').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).eq('status', 'confirmed'),
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', currentSiteId).is('replied_at', null).is('anonymized_at', null),
  ])
  const badges: Record<string, number> = {}
  if (draftsRes.count) badges['/cms/blog'] = draftsRes.count
  if (subsRes.count) badges['/cms/subscribers'] = subsRes.count
  if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count

  return (
    <CmsAdminProvider linkComponent={Link}>
      <SiteSwitcherProvider sites={sites} initialSiteId={currentSiteId}>
        <CmsShell
          siteName={currentSite?.site_name ?? 'OneCMS'}
          siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
          userDisplayName={userDisplayName}
          userRole={userRole}
          siteSwitcher={<CmsSiteSwitcherSlot />}
          badges={badges}
        >
          {children}
        </CmsShell>
      </SiteSwitcherProvider>
    </CmsAdminProvider>
  )
}
