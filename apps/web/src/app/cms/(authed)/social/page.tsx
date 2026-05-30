import { Suspense } from 'react'
import Link from 'next/link'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSocialStrings } from './_i18n'
import { SocialBreadcrumb } from './_components/shared/social-breadcrumb'
import { SocialPageHeader } from './_components/shared/social-page-header'
import { AccountsStripLoader } from './_components/accounts-strip'
import { FeedViewLoader } from './_components/feed-view-loader'
import { CalendarViewLoader } from './_components/calendar-view-loader'
import { QueueViewLoader } from './_components/queue-view-loader'
import { DraftsViewLoader } from './_components/drafts-view-loader'

export const dynamic = 'force-dynamic'

const TABS = ['feed', 'calendar', 'queue', 'drafts'] as const
type TabId = (typeof TABS)[number]

interface Props {
  searchParams: Promise<{ tab?: string; status?: string; week?: string }>
}

export default async function SocialHubPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = (TABS.includes(params.tab as TabId) ? params.tab : 'feed') as TabId

  const breadcrumb = (
    <SocialBreadcrumb crumbs={[
      { label: 'Social', href: '/cms/social' },
      { label: t.posts.tabs[tab] },
    ]} />
  )

  const actions = (
    <>
      <Link
        href="/cms/social/new?mode=cms"
        className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface transition-colors"
      >
        Do CMS
      </Link>
      <Link
        href="/cms/social/new"
        className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover transition-colors"
      >
        Novo post
      </Link>
    </>
  )

  return (
    <div className="p-6 space-y-6">
      <SocialPageHeader
        breadcrumb={breadcrumb}
        title="Social Studio"
        subtitle="Gerenciar posts, agenda e fila de publicacao"
        actions={actions}
      />

      {/* Tab bar */}
      <div role="tablist" className="flex gap-1 border-b border-cms-border">
        {TABS.map(tabId => (
          <Link
            key={tabId}
            id={`social-tab-${tabId}`}
            href={tabId === 'feed' ? '/cms/social' : `/cms/social?tab=${tabId}`}
            role="tab"
            aria-selected={tab === tabId}
            aria-controls="social-tabpanel"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabId
                ? 'text-cms-accent border-b-2 border-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {t.posts.tabs[tabId]}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id="social-tabpanel" aria-labelledby={`social-tab-${tab}`}>
        {tab === 'feed' && (
          <>
            <Suspense fallback={<AccountsStripSkeleton />}>
              <AccountsStripLoader siteId={ctx.siteId} />
            </Suspense>
            <Suspense fallback={<FeedSkeleton />}>
              <FeedViewLoader siteId={ctx.siteId} status={params.status} />
            </Suspense>
          </>
        )}
        {tab === 'calendar' && (
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarViewLoader siteId={ctx.siteId} week={params.week} />
          </Suspense>
        )}
        {tab === 'queue' && (
          <Suspense fallback={<QueueSkeleton />}>
            <QueueViewLoader siteId={ctx.siteId} />
          </Suspense>
        )}
        {tab === 'drafts' && (
          <Suspense fallback={<DraftsSkeleton />}>
            <DraftsViewLoader siteId={ctx.siteId} />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function AccountsStripSkeleton() {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-3 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-cms-surface" />)}
  </div>
}

function FeedSkeleton() {
  return <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4 animate-pulse">
    {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 rounded-lg bg-cms-surface" />)}
  </div>
}

function CalendarSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-cms-surface" />
}

function QueueSkeleton() {
  return <div className="space-y-2 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-cms-surface" />)}
  </div>
}

function DraftsSkeleton() {
  return <div className="space-y-2 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-cms-surface" />)}
  </div>
}
