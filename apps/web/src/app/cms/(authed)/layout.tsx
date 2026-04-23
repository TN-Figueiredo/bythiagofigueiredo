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
import { CmsSiteSwitcherSlot } from '../../../components/cms/site-switcher-provider'
import { CmsShell } from '../../../components/cms/cms-shell'

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
  const sites = (sitesData ?? []) as AccessibleSite[]
  const currentSiteId = sites[0]?.site_id ?? ''
  const currentSite = sites.find((s) => s.site_id === currentSiteId)
  const userDisplayName = user.email ?? 'User'
  const userRole = currentSite?.user_role ?? 'reporter'

  return (
    <SiteSwitcherProvider sites={sites} initialSiteId={currentSiteId}>
      <CmsShell
        siteName={currentSite?.site_name ?? 'OneCMS'}
        siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
        userDisplayName={userDisplayName}
        userRole={userRole}
        siteSwitcher={<CmsSiteSwitcherSlot />}
      >
        {children}
      </CmsShell>
    </SiteSwitcherProvider>
  )
}
