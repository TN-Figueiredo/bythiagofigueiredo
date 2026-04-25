'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { KpiCard, formatRelativeTime } from '@tn-figueiredo/cms-ui/client'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface KpiData {
  publishedPosts: number
  publishedPostsDelta: number | null
  subscribers: number
  subscribersDelta: number | null
  avgOpenRate: number | null
  avgOpenRateDelta: number | null
  unreadMessages: number
}

export interface LastNewsletterData {
  id: string
  subject: string
  sentAt: string
  delivered: number
  opens: number
  clicks: number
  bounces: number
}

export interface ComingUpItem {
  id: string
  title: string
  date: string
  type: 'post' | 'newsletter'
  href: string
}

export interface DraftItem {
  id: string
  title: string
  updatedAt: string
  type: 'post' | 'newsletter' | 'campaign'
  href: string
}

export interface ActivityItem {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
  actorEmail: string | null
}

export interface TopContentRow {
  id: string
  title: string
  views: number
  locale: string
}

export interface DashboardData {
  kpis: KpiData
  lastNewsletter: LastNewsletterData | null
  comingUp: ComingUpItem[]
  drafts: DraftItem[]
  recentActivity: ActivityItem[]
  topPosts: TopContentRow[]
  topNewsletters: TopContentRow[]
  topCampaigns: TopContentRow[]
}

interface Props {
  data: DashboardData
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDelta(value: number | null, suffix = '%'): string {
  if (value === null || value === 0) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${suffix}`
}

function deltaDirection(
  value: number | null,
): 'up' | 'down' | 'flat' {
  if (value === null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

function groupByDay(items: ComingUpItem[]): { label: string; items: ComingUpItem[] }[] {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)

  const groups = new Map<string, ComingUpItem[]>()
  for (const item of items) {
    const day = item.date.slice(0, 10)
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(item)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => ({
      label:
        day === today
          ? 'Today'
          : day === tomorrow
            ? 'Tomorrow'
            : new Date(day + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              }),
      items: dayItems,
    }))
}

function typeIcon(type: string): string {
  switch (type) {
    case 'post':
      return 'P'
    case 'newsletter':
      return 'N'
    case 'campaign':
      return 'C'
    default:
      return '?'
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'post':
      return 'bg-indigo-500/20 text-indigo-400'
    case 'newsletter':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'campaign':
      return 'bg-amber-500/20 text-amber-400'
    default:
      return 'bg-slate-500/20 text-slate-400'
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

type TopContentTab = 'posts' | 'newsletters' | 'campaigns'

function KpiStrip({ kpis }: { kpis: KpiData }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      data-testid="kpi-strip"
    >
      <KpiCard
        label="Published Posts"
        value={kpis.publishedPosts}
        trend={{
          direction: deltaDirection(kpis.publishedPostsDelta),
          label: formatDelta(kpis.publishedPostsDelta),
        }}
        trendPositive="up"
        color="default"
      />
      <KpiCard
        label="Subscribers"
        value={kpis.subscribers}
        trend={{
          direction: deltaDirection(kpis.subscribersDelta),
          label: formatDelta(kpis.subscribersDelta),
        }}
        trendPositive="up"
        color="green"
      />
      <KpiCard
        label="Avg Open Rate"
        value={kpis.avgOpenRate !== null ? `${kpis.avgOpenRate.toFixed(1)}%` : '0%'}
        trend={{
          direction: deltaDirection(kpis.avgOpenRateDelta),
          label: formatDelta(kpis.avgOpenRateDelta, ' pp'),
        }}
        trendPositive="up"
        color="cyan"
      />
      <KpiCard
        label="Unread Messages"
        value={kpis.unreadMessages}
        color={kpis.unreadMessages > 0 ? 'amber' : 'default'}
      />
    </div>
  )
}

function NewsletterBanner({
  newsletter,
}: {
  newsletter: LastNewsletterData
}) {
  const openRate =
    newsletter.delivered > 0
      ? ((newsletter.opens / newsletter.delivered) * 100).toFixed(1)
      : '0'

  return (
    <div
      className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white"
      data-testid="newsletter-banner"
    >
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-200">
        Last Newsletter
      </div>
      <h3 className="mb-3 text-lg font-semibold leading-tight">
        {newsletter.subject}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {newsletter.delivered.toLocaleString()}
          </div>
          <div className="text-xs text-indigo-200">Delivered</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {openRate}%
          </div>
          <div className="text-xs text-indigo-200">Opens</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {newsletter.clicks.toLocaleString()}
          </div>
          <div className="text-xs text-indigo-200">Clicks</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">
            {newsletter.bounces}
          </div>
          <div className="text-xs text-indigo-200">Bounces</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-indigo-200">
        Sent {formatRelativeTime(newsletter.sentAt)}
      </div>
    </div>
  )
}

function ComingUpSection({ items }: { items: ComingUpItem[] }) {
  const groups = useMemo(() => groupByDay(items), [items])

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="coming-up-empty">
        Nothing scheduled for the next 7 days.
      </p>
    )
  }

  return (
    <div className="space-y-4" data-testid="coming-up-list">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {group.label}
          </div>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 hover:border-indigo-500/50 hover:bg-slate-800 transition-colors"
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${typeColor(item.type)}`}
                  >
                    {typeIcon(item.type)}
                  </span>
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ContinueEditingSection({ drafts }: { drafts: DraftItem[] }) {
  if (drafts.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="drafts-empty">
        No drafts in progress.
      </p>
    )
  }

  return (
    <ul className="space-y-2" data-testid="drafts-list">
      {drafts.map((draft) => (
        <li key={draft.id}>
          <Link
            href={draft.href}
            className="block rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 hover:border-indigo-500/50 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${typeColor(draft.type)}`}
              >
                {typeIcon(draft.type)}
              </span>
              <span className="truncate text-sm font-medium text-slate-200">
                {draft.title}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Updated {formatRelativeTime(draft.updatedAt)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function RecentActivitySection({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="activity-empty">
        No recent activity.
      </p>
    )
  }

  return (
    <ul className="space-y-3" data-testid="activity-list">
      {activity.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
          <div className="min-w-0">
            <p className="text-sm text-slate-200">
              <span className="font-medium">{item.action}</span>
              {item.resourceType && (
                <span className="text-slate-400">
                  {' '}
                  on {item.resourceType}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              {item.actorEmail ? `${item.actorEmail} · ` : ''}
              {formatRelativeTime(item.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function TopContentSection({
  posts,
  newsletters,
  campaigns,
}: {
  posts: TopContentRow[]
  newsletters: TopContentRow[]
  campaigns: TopContentRow[]
}) {
  const [tab, setTab] = useState<TopContentTab>('posts')

  const tabs: { id: TopContentTab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'newsletters', label: 'Newsletters' },
    { id: 'campaigns', label: 'Campaigns' },
  ]

  const rows =
    tab === 'posts'
      ? posts
      : tab === 'newsletters'
        ? newsletters
        : campaigns

  return (
    <div data-testid="top-content">
      <div className="mb-4 flex gap-1 rounded-md bg-slate-800/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="top-content-empty">
          No data yet.
        </p>
      ) : (
        <table className="w-full text-sm" data-testid="top-content-table">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Title</th>
              <th className="pb-2 text-right font-medium">Views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-700/50 last:border-0"
              >
                <td className="py-2 text-slate-200">{row.title}</td>
                <td className="py-2 text-right tabular-nums text-slate-400">
                  {row.views.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OnboardingCards() {
  const cards = [
    {
      title: 'Write your first post',
      description: 'Create a blog post to get started with your content.',
      href: '/cms/blog/new',
      icon: 'P',
      color: 'from-indigo-600 to-indigo-500',
    },
    {
      title: 'Set up a newsletter',
      description: 'Configure your newsletter type and start building your audience.',
      href: '/cms/newsletters/settings',
      icon: 'N',
      color: 'from-emerald-600 to-emerald-500',
    },
    {
      title: 'Create a campaign',
      description: 'Launch a campaign to engage your audience.',
      href: '/cms/campaigns/new',
      icon: 'C',
      color: 'from-amber-600 to-amber-500',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="onboarding-cards">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group rounded-lg border border-slate-700 bg-slate-800/50 p-5 transition-colors hover:border-indigo-500/50"
        >
          <div
            className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-lg font-bold text-white`}
          >
            {card.icon}
          </div>
          <h3 className="mb-1 text-sm font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
            {card.title}
          </h3>
          <p className="text-xs text-slate-400">{card.description}</p>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

export function DashboardConnected({ data }: Props) {
  const {
    kpis,
    lastNewsletter,
    comingUp,
    drafts,
    recentActivity,
    topPosts,
    topNewsletters,
    topCampaigns,
  } = data

  const isEmpty =
    kpis.publishedPosts === 0 &&
    kpis.subscribers === 0 &&
    drafts.length === 0 &&
    comingUp.length === 0

  return (
    <div className="space-y-6 p-6 lg:p-8" data-testid="dashboard">
      {/* KPI Strip */}
      <KpiStrip kpis={kpis} />

      {/* Last Newsletter Banner */}
      {lastNewsletter && <NewsletterBanner newsletter={lastNewsletter} />}

      {/* Empty state vs. content */}
      {isEmpty ? (
        <OnboardingCards />
      ) : (
        <>
          {/* 3-column middle section */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">
                Coming Up
              </h3>
              <ComingUpSection items={comingUp} />
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">
                Continue Editing
              </h3>
              <ContinueEditingSection drafts={drafts} />
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-200">
                Recent Activity
              </h3>
              <RecentActivitySection activity={recentActivity} />
            </div>
          </div>

          {/* Top Content */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-200">
              Top Content
            </h3>
            <TopContentSection
              posts={topPosts}
              newsletters={topNewsletters}
              campaigns={topCampaigns}
            />
          </div>
        </>
      )}
    </div>
  )
}
