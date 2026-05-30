import { Suspense } from 'react'
import Link from 'next/link'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSocialStrings } from './_i18n'
import { AccountsStripLoader } from './_components/accounts-strip'
import { AccountsStripClient } from './_components/accounts-strip-client'
import { FeedViewLoader } from './_components/feed-view-loader'
import { FeedGrid } from './_components/feed-grid'
import { MOCK_CONNECTIONS, MOCK_FEED_ITEMS, MOCK_CALENDAR, MOCK_QUEUE_ITEMS, MOCK_DRAFT_ITEMS } from './_components/design-preview-data'
import { CalendarViewLoader } from './_components/calendar-view-loader'
import { CalendarWeekView } from './_components/calendar-week-view'
import { QueueViewLoader } from './_components/queue-view-loader'
import { DraftsViewLoader } from './_components/drafts-view-loader'
import { QueueList } from './_components/queue-list'
import { DraftsList } from './_components/drafts-list'

export const dynamic = 'force-dynamic'

const TABS = ['feed', 'calendar', 'queue', 'drafts'] as const
type TabId = (typeof TABS)[number]

interface Props {
  searchParams: Promise<{ tab?: string; status?: string; week?: string; view?: string }>
}

export default async function SocialHubPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = (TABS.includes(params.tab as TabId) ? params.tab : 'feed') as TabId
  const isDesignPreview = params.view === 'design'

  return (
    <div className="px-[30px] pt-5 space-y-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-[7px] mb-2.5">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-cms-text-dim shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3L3 10l7 3 3 7z" />
          </svg>
          Social
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-text-dim/50 shrink-0">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="text-[12.5px] font-semibold text-cms-text truncate max-w-[220px]">
          Posts
        </span>
      </div>

      {/* Title + actions row */}
      <div className="flex items-end justify-between gap-3.5 flex-wrap mb-1.5">
        <h1 className="font-fraunces text-[29px] font-semibold tracking-[-0.01em] whitespace-nowrap m-0">
          Posts
        </h1>
        <div className="flex gap-2.5 flex-wrap">
          {/* Do CMS button — ghost */}
          <Link
            href="/cms/social/new?mode=cms"
            className="inline-flex items-center gap-[7px] justify-center px-[11px] py-1.5 text-[12.5px] font-semibold rounded-[9px] border border-cms-border bg-transparent text-cms-text-dim whitespace-nowrap tracking-[-0.01em] hover:text-cms-text transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M14 3v5h5" />
              <path d="M9 12h7" />
              <path d="M9 16h7" />
            </svg>
            Do CMS
          </Link>
          {/* Novo post button — primary */}
          <Link
            href="/cms/social/new"
            className="inline-flex items-center gap-[7px] justify-center px-[15px] py-[9px] text-[13.5px] font-semibold rounded-[9px] border border-cms-accent bg-cms-accent text-[#1a120c] whitespace-nowrap tracking-[-0.01em] hover:brightness-110 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Novo post
          </Link>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-cms-text-dim max-w-[640px] mb-[22px]">
        Story do Instagram é o padrão da casa · YouTube só na Comunidade · Facebook na fanpage.
      </p>

      {/* Tab bar */}
      <div role="tablist" className="flex gap-[26px] border-b border-cms-border">
        {TABS.map(tabId => (
          <Link
            key={tabId}
            id={`social-tab-${tabId}`}
            href={tabId === 'feed' ? '/cms/social' : `/cms/social?tab=${tabId}`}
            role="tab"
            aria-selected={tab === tabId}
            aria-controls="social-tabpanel"
            className={`relative pb-[13px] px-px text-sm cursor-pointer ${
              tab === tabId
                ? 'text-cms-text font-semibold'
                : 'text-cms-text-dim font-medium hover:text-cms-text'
            } transition-colors`}
          >
            {t.posts.tabs[tabId]}
            {tab === tabId && (
              <div className="absolute left-0 right-0 -bottom-px h-0.5 bg-cms-accent rounded-full" />
            )}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id="social-tabpanel" aria-labelledby={`social-tab-${tab}`} className="pt-6">
        {tab === 'feed' && (
          <>
            {isDesignPreview ? (
              <>
                <AccountsStripClient connections={MOCK_CONNECTIONS} />
                <FeedGrid items={MOCK_FEED_ITEMS} />
              </>
            ) : (
              <>
                <Suspense fallback={<AccountsStripSkeleton />}>
                  <AccountsStripLoader siteId={ctx.siteId} />
                </Suspense>
                <Suspense fallback={<FeedSkeleton />}>
                  <FeedViewLoader siteId={ctx.siteId} status={params.status} />
                </Suspense>
              </>
            )}
          </>
        )}
        {tab === 'calendar' && (
          <>
            {isDesignPreview ? (
              <CalendarWeekView
                days={MOCK_CALENDAR.days}
                weekLabel={MOCK_CALENDAR.weekLabel}
                prevWeek={MOCK_CALENDAR.prevWeek}
                nextWeek={MOCK_CALENDAR.nextWeek}
                dateRange={MOCK_CALENDAR.dateRange}
              />
            ) : (
              <Suspense fallback={<CalendarSkeleton />}>
                <CalendarViewLoader siteId={ctx.siteId} week={params.week} />
              </Suspense>
            )}
          </>
        )}
        {tab === 'queue' && (
          <>
            {isDesignPreview ? (
              <QueueList initialItems={MOCK_QUEUE_ITEMS} />
            ) : (
              <Suspense fallback={<QueueSkeleton />}>
                <QueueViewLoader siteId={ctx.siteId} />
              </Suspense>
            )}
          </>
        )}
        {tab === 'drafts' && (
          <>
            {isDesignPreview ? (
              <DraftsList items={MOCK_DRAFT_ITEMS} />
            ) : (
              <Suspense fallback={<DraftsSkeleton />}>
                <DraftsViewLoader siteId={ctx.siteId} />
              </Suspense>
            )}
          </>
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
