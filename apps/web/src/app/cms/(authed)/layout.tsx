import {
  createServerClient,
} from '@tn-figueiredo/auth-nextjs'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import {
  SiteSwitcherProvider,
  CmsSiteSwitcherSlot,
  type AccessibleSite,
  type RpcAccessibleSite,
} from '@/components/cms/site-switcher-provider'
import { CmsShell } from '@tn-figueiredo/cms-ui/client'
import { CmsAdminProvider } from '@tn-figueiredo/cms-admin/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { fetchSidebarBadges } from '@/lib/cms/sidebar-badges'
import { fetchLayoutCounts } from '@/lib/cms/layout-counts'
import { SidebarBadges } from '@/components/cms/sidebar-badges'
import { SiteTimezoneProvider } from '@/lib/cms/site-timezone-context'
import { NotificationProvider } from '@/lib/notifications/notification-context'
import { NotificationBell } from './_shared/notification-bell'
import { buildCmsSections } from './_shared/cms-sections'
import Link from 'next/link'
import type { INotification } from '@/lib/notifications/types'

const CMS_SECTIONS = buildCmsSections()

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
  // --- Auth gate (inlined from requireArea('cms')) ---
  // Single getUser() round-trip. requireArea internally called getUser() a
  // second time + is_member_staff RPC sequentially. We do both RPCs in parallel.
  // Security: getUser() validates against auth server (not just JWT).
  // If @tn-figueiredo/auth-nextjs updates requireArea semantics, update here.
  const { data: { user: rawUser }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !rawUser) redirect('/cms/login')

  const [staffRes, sitesRes] = await Promise.all([
    supabase.rpc('is_member_staff'),
    supabase.rpc('user_accessible_sites'),
  ])
  if (staffRes.error || !staffRes.data) redirect('/?error=insufficient_access')

  const user = { id: rawUser.id, email: rawUser.email ?? '' }
  const rawSites = (sitesRes.data ?? []) as RpcAccessibleSite[]
  const sites = rawSites.map((s) => ({
    id: s.site_id,
    slug: s.site_slug,
    name: s.site_name,
    primary_domain: s.primary_domain,
    logo_url: null,
  })) as AccessibleSite[]
  const currentSiteId = rawSites[0]?.site_id ?? ''
  const currentSite = rawSites.find((s) => s.site_id === currentSiteId)
  const userDisplayName = rawUser.email ?? 'User'
  const userRole = currentSite?.user_role ?? 'reporter'

  const { siteId: middlewareSiteId, timezone: siteTimezone } = await getSiteContext()
  const svc = getSupabaseServiceClient()
  const [badgeData, layoutCounts, notificationsRes] = await Promise.all([
    fetchSidebarBadges(middlewareSiteId, siteTimezone),
    fetchLayoutCounts(middlewareSiteId),
    svc.from('notifications').select('id, site_id, user_id, type, domain, title, message, action_href, suggested_action, priority, read_at, dismissed_at, expired_at, snoozed_until, dedup_key, group_key, created_at')
      .eq('site_id', middlewareSiteId)
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .is('expired_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const badges: Record<string, number> = {}
  if (layoutCounts.pendingContacts) badges['/cms/contacts'] = layoutCounts.pendingContacts
  if (layoutCounts.ytPending) badges['/cms/youtube'] = layoutCounts.ytPending
  if (layoutCounts.researchUnread) badges['/cms/library/research'] = layoutCounts.researchUnread

  const initialNotifications = (notificationsRes.data ?? []) as INotification[]
  const unreadCount = initialNotifications.filter((n) => !n.read_at).length
  const hasCritical = initialNotifications.some((n) => n.priority >= 4 && !n.read_at)

  return (
    <CmsAdminProvider linkComponent={Link}>
      <SiteTimezoneProvider value={siteTimezone}>
        <NotificationProvider initialItems={initialNotifications}>
          <SiteSwitcherProvider sites={sites} initialSiteId={currentSiteId}>
            <CmsShell
              siteName={currentSite?.site_name ?? 'OneCMS'}
              siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
              logoUrl="/brand/monogram-cms.svg"
              logoUrlLight="/brand/monogram-cms-light.svg"
              userDisplayName={userDisplayName}
              userRole={userRole}
              siteSwitcher={<CmsSiteSwitcherSlot sites={rawSites} />}
              sections={CMS_SECTIONS}
              badges={badges}
            >
              <div className="fixed top-3 right-4 z-[60]">
                <NotificationBell initialCount={unreadCount} hasCritical={hasCritical} />
              </div>
              <SidebarBadges data={badgeData} />
              {children}
            </CmsShell>
          </SiteSwitcherProvider>
        </NotificationProvider>
      </SiteTimezoneProvider>
    </CmsAdminProvider>
  )
}
