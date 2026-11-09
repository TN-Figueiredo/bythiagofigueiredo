import {
  createServerClient,
} from '@tn-figueiredo/auth-nextjs'
import { PasswordChangedNotice } from '../../_auth/password-changed-notice'
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
import { getSiteContext } from '@/lib/cms/site-context'
import { fetchSidebarBadges } from '@/lib/cms/sidebar-badges'
import { fetchLayoutCounts } from '@/lib/cms/layout-counts'
import type { SidebarBadgeData } from '@/lib/cms/sidebar-badges'
import { SidebarBadges } from '@/components/cms/sidebar-badges'
import { SiteTimezoneProvider } from '@/lib/cms/site-timezone-context'
import { SiteAdminProvider } from '@/lib/cms/site-admin-context'
import { requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { NotificationProvider } from '@/lib/notifications/notification-context'
import { CmsTopbar } from './_shared/cms-topbar'
import { buildCmsSections, CMS_SETTINGS_ITEM } from './_shared/cms-sections'
import CmsLink from './_shared/cms-link'

const CMS_SECTIONS = buildCmsSections()

// A2: o que o layout entrega a quem só lê (nenhum número do CMS no payload)
const BADGES_VAZIOS: SidebarBadgeData = { posts: { wip: 0 }, newsletters: { wip: 0, wipDraft: 0, wipReady: 0, urgency: null }, pipeline: { urgency: null } }
const CONTAGENS_VAZIAS = { pendingContacts: 0, ytPending: 0, researchUnread: 0, waitlistsNeedAttention: 0 }

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
  const { siteId: middlewareSiteId, timezone: siteTimezone } = await getSiteContext()
  // A2 (MG19): o mesmo predicado da porta de papel do middleware. Quem não edita o site do host é tratado como `reporter`: menu só do
  // Observatório e nenhum contador do CMS no payload (os números iriam junto).
  const podeEditarHost = (await supabase.rpc('can_edit_site', { p_site_id: middlewareSiteId })).data === true
  const userRole = podeEditarHost ? (currentSite?.user_role ?? 'reporter') : 'reporter'

  // Degrau "administrar o site": só decide o que a TELA mostra (cada action
  // restrita confere de novo no servidor). Falha fechado → controles somem.
  const [badgeData, layoutCounts, siteAdmin] = await Promise.all([
    podeEditarHost ? fetchSidebarBadges(middlewareSiteId, siteTimezone) : Promise.resolve(BADGES_VAZIOS),
    podeEditarHost ? fetchLayoutCounts(middlewareSiteId) : Promise.resolve(CONTAGENS_VAZIAS),
    requireSiteAdminScope(middlewareSiteId),
  ])
  const badges: Record<string, number> = {}
  if (layoutCounts.pendingContacts) badges['/cms/contacts'] = layoutCounts.pendingContacts
  if (layoutCounts.ytPending) badges['/cms/youtube'] = layoutCounts.ytPending
  if (layoutCounts.researchUnread) badges['/cms/library/research'] = layoutCounts.researchUnread

  return (
    <CmsAdminProvider linkComponent={CmsLink}>
      <SiteAdminProvider value={siteAdmin.ok}>
      <SiteTimezoneProvider value={siteTimezone}>
        <NotificationProvider>
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
              settingsItem={CMS_SETTINGS_ITEM}
              badges={badges}
            >
              <PasswordChangedNotice />
              <CmsTopbar />
              <SidebarBadges data={badgeData} />
              {children}
            </CmsShell>
          </SiteSwitcherProvider>
        </NotificationProvider>
      </SiteTimezoneProvider>
      </SiteAdminProvider>
    </CmsAdminProvider>
  )
}
