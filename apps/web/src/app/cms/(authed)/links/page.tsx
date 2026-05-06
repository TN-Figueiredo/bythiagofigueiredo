import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LinksDashboard } from '@tn-figueiredo/links-admin/client'
import type { LinkSummary, DashboardKpis } from '@tn-figueiredo/links-admin'
import { getLinks, createLink, deleteLink, toggleLinkActive } from './actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function LinksDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  // Fetch stats summary
  const [totalRes, activeRes, clicksRes] = await Promise.all([
    supabase
      .from('tracked_links')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .is('deleted_at', null),
    supabase
      .from('tracked_links')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('active', true)
      .is('deleted_at', null),
    supabase
      .from('tracked_links')
      .select('code, total_clicks')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .order('total_clicks', { ascending: false })
      .limit(1),
  ])

  const totalLinks = totalRes.count ?? 0
  const activeLinks = activeRes.count ?? 0
  const topRow = clicksRes.data?.[0]
  const totalClicks = topRow ? (topRow.total_clicks as number) ?? 0 : 0

  const metrics: DashboardKpis = {
    totalLinks,
    activeLinks,
    totalClicks,
    topPerformer: topRow
      ? { code: topRow.code as string, clicks: (topRow.total_clicks as number) ?? 0 }
      : null,
  }

  // Fetch paginated links
  const page = parseInt(params.page ?? '1', 10)
  const search = params.search ?? undefined
  const sourceType = params.source_type ?? undefined
  const activeFilter = params.active !== undefined
    ? params.active === 'true'
    : undefined

  const linksResult = await getLinks(siteId, {
    page,
    search,
    source_type: sourceType as 'manual' | 'campaign' | 'newsletter' | 'blog' | 'social' | 'print' | undefined,
    active: activeFilter,
  })

  const rawLinks = linksResult.ok ? linksResult.links : []
  const links: LinkSummary[] = (rawLinks as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    slug: (l.slug as string) ?? null,
    title: (l.title as string) ?? null,
    destination_url: l.destination_url as string,
    source_type: l.source_type as string,
    tags: (l.tags as string[]) ?? [],
    active: l.active as boolean,
    redirect_type: (l.redirect_type as number) ?? 302,
    expires_at: (l.expires_at as string) ?? null,
    total_clicks: (l.total_clicks as number) ?? 0,
    unique_visitors: (l.unique_visitors as number) ?? 0,
    last_clicked_at: (l.last_clicked_at as string) ?? null,
    created_at: l.created_at as string,
    updated_at: l.updated_at as string,
  }))

  async function handleCreateLink() {
    'use server'
    redirect('/cms/links/new')
  }

  async function handleDeleteLink(id: string) {
    'use server'
    await deleteLink(id)
  }

  async function handleToggleActive(id: string) {
    'use server'
    await toggleLinkActive(id)
  }

  return (
    <LinksDashboard
      metrics={metrics}
      links={links}
      onCreateLink={handleCreateLink}
      onDeleteLink={handleDeleteLink}
      onToggleActive={handleToggleActive}
    />
  )
}
