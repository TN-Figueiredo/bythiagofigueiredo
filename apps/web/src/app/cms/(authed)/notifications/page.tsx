import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { InboxClient } from './_components/inbox-client'
import type { INotification, NotificationDomain } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Notificacoes',
}

// ---------------------------------------------------------------------------
// Skeleton fallback
// ---------------------------------------------------------------------------

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-[900px] p-6 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-6 w-56 rounded bg-cms-surface-hover mb-2" />
        <div className="h-4 w-36 rounded bg-cms-surface-hover" />
      </div>
      {/* Filter chips skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-cms-surface-hover" />
        ))}
      </div>
      {/* Rows skeleton */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-4 border-b border-cms-border">
          <div className="h-5 w-5 rounded bg-cms-surface-hover shrink-0 mt-0.5" />
          <div className="h-8 w-8 rounded-full bg-cms-surface-hover shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-cms-surface-hover" />
            <div className="h-3 w-1/2 rounded bg-cms-surface-hover" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

interface InboxData {
  notifications: INotification[]
  totalCount: number
  unreadCount: number
  domainCounts: Record<NotificationDomain, number>
}

async function fetchInboxData(
  siteId: string,
  userId: string,
): Promise<InboxData> {
  const supabase = getSupabaseServiceClient()

  const [notifRes, countRes, unreadRes, domainRes] = await Promise.all([
    // First page: 50 items, most recent first, excluding dismissed
    supabase
      .from('notifications')
      .select('*')
      .eq('site_id', siteId)
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50),

    // Total count (non-dismissed)
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('user_id', userId)
      .is('dismissed_at', null),

    // Unread count
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('user_id', userId)
      .is('dismissed_at', null)
      .is('read_at', null),

    // Per-domain unread counts
    supabase.rpc('notification_domain_counts', {
      p_site_id: siteId,
      p_user_id: userId,
    }),
  ])

  // Build domain counts from RPC result or fallback to empty
  const domainCounts = {} as Record<NotificationDomain, number>
  const allDomains: NotificationDomain[] = [
    'pipeline', 'youtube', 'newsletter', 'social', 'links', 'blog', 'media', 'system',
  ]
  for (const d of allDomains) {
    domainCounts[d] = 0
  }

  if (domainRes.data && Array.isArray(domainRes.data)) {
    for (const row of domainRes.data as Array<{ domain: string; count: number }>) {
      if (row.domain in domainCounts) {
        domainCounts[row.domain as NotificationDomain] = row.count
      }
    }
  } else {
    // Fallback: compute from loaded notifications
    const items = (notifRes.data ?? []) as INotification[]
    for (const n of items) {
      if (!n.read_at && n.domain in domainCounts) {
        domainCounts[n.domain]++
      }
    }
  }

  return {
    notifications: (notifRes.data ?? []) as INotification[],
    totalCount: countRes.count ?? 0,
    unreadCount: unreadRes.count ?? 0,
    domainCounts,
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function NotificationsPage() {
  const { siteId } = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const userId = authRes.user.id

  return (
    <>
      <CmsTopbar title="Notificacoes" />
      <Suspense fallback={<InboxSkeleton />}>
        <InboxContent siteId={siteId} userId={userId} />
      </Suspense>
    </>
  )
}

async function InboxContent({
  siteId,
  userId,
}: {
  siteId: string
  userId: string
}) {
  const data = await fetchInboxData(siteId, userId)

  return (
    <InboxClient
      initialNotifications={data.notifications}
      totalCount={data.totalCount}
      unreadCount={data.unreadCount}
      domainCounts={data.domainCounts}
      siteId={siteId}
    />
  )
}
