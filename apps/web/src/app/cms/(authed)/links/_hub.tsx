'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LinksDashboard } from '@tn-figueiredo/links-admin/client'
import type { DashboardKpis, DashboardActivity, LinkSummary } from '@tn-figueiredo/links-admin'
import { deleteLink, toggleLinkActive } from './actions'

interface LinksHubProps {
  metrics: DashboardKpis
  activity: DashboardActivity
  links: unknown[]
  siteId: string
}

export function LinksHub({ metrics, activity, links, siteId: _siteId }: LinksHubProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const typedLinks: LinkSummary[] = (links as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    slug: (l.slug as string) ?? null,
    title: (l.title as string) ?? null,
    destination_url: l.destination_url as string,
    source_type: (l.source_type as string) ?? 'manual',
    tags: (l.tags as string[]) ?? [],
    active: (l.active as boolean) ?? true,
    redirect_type: (l.redirect_type as number) ?? 302,
    expires_at: (l.expires_at as string) ?? null,
    total_clicks: (l.total_clicks as number) ?? 0,
    unique_visitors: (l.unique_visitors as number) ?? 0,
    last_clicked_at: (l.last_clicked_at as string) ?? null,
    created_at: l.created_at as string,
    updated_at: l.updated_at as string,
  }))

  return (
    <LinksDashboard
      links={typedLinks}
      metrics={metrics}
      activity={activity}
      onCreateLink={() => router.push('/cms/links/new')}
      onSelectLink={(id) => router.push(`/cms/links/${id}`)}
      onEditLink={(id) => router.push(`/cms/links/${id}/edit`)}
      onDeleteLink={(id) => {
        startTransition(async () => {
          await deleteLink(id)
          router.refresh()
        })
      }}
      onToggleActive={(id) => {
        startTransition(async () => {
          await toggleLinkActive(id)
          router.refresh()
        })
      }}
    />
  )
}
