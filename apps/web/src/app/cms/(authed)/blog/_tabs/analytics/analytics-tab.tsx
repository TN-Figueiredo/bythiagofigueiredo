'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Eye, BookOpen, Gauge, Clock, Loader2 } from 'lucide-react'
import { fetchContentAnalytics } from '../../../analytics/actions'
import type { ContentAnalyticsData } from '../../../analytics/actions'
import type { PeriodInput } from '../../../analytics/types'
import { EmptyState } from '../../_shared/empty-state'
import type { BlogHubStrings } from '../../_i18n/types'

type PeriodKey = '7d' | '30d' | '90d' | 'all'

interface AnalyticsTabProps {
  strings?: BlogHubStrings
}

const REFERRER_COLORS: Record<string, string> = {
  direct: 'bg-blue-500',
  google: 'bg-green-500',
  newsletter: 'bg-purple-500',
  social: 'bg-orange-500',
  other: 'bg-gray-500',
}

export function AnalyticsTab({ strings }: AnalyticsTabProps) {
  const s = strings?.analytics
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [data, setData] = useState<ContentAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: PeriodKey) => {
    setLoading(true)
    setError(null)
    const input: PeriodInput = { type: 'preset', value: p }
    const res = await fetchContentAnalytics(input)
    if (res.ok) {
      setData(res.data)
    } else {
      setError(res.error)
      setData(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load(period)
  }, [period, load])

  const periodOptions: { key: PeriodKey; label: string }[] = [
    { key: '7d', label: s?.period7d ?? '7 days' },
    { key: '30d', label: s?.period30d ?? '30 days' },
    { key: '90d', label: s?.period90d ?? '90 days' },
    { key: 'all', label: s?.periodAll ?? 'All time' },
  ]

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {periodOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === opt.key
                ? 'bg-gray-700 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (!data || data.posts.length === 0) && (
        <EmptyState
          icon={<TrendingUp className="h-10 w-10 text-gray-600" />}
          heading={s?.noData ?? 'No analytics data for this period.'}
        />
      )}

      {!loading && !error && data && data.posts.length > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              icon={<Eye className="h-4 w-4" />}
              label={s?.totalViews ?? 'Total Views'}
              value={formatNumber(data.totals.views)}
            />
            <KpiCard
              icon={<BookOpen className="h-4 w-4" />}
              label={s?.readsComplete ?? 'Reads Complete'}
              value={formatNumber(data.totals.readsComplete)}
            />
            <KpiCard
              icon={<Gauge className="h-4 w-4" />}
              label={s?.avgDepth ?? 'Avg Depth'}
              value={`${data.totals.avgDepth}%`}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label={s?.avgTime ?? 'Avg Time (s)'}
              value={`${data.totals.avgTime}s`}
            />
          </div>

          {/* Top posts table */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-200">{s?.topPosts ?? 'Top Posts'}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500">
                    <th className="px-4 py-2 font-medium">{s?.title ?? 'Title'}</th>
                    <th className="px-3 py-2 text-right font-medium">{s?.views ?? 'Views'}</th>
                    <th className="px-3 py-2 text-right font-medium">{s?.unique ?? 'Unique'}</th>
                    <th className="px-3 py-2 text-right font-medium">{s?.reads ?? 'Reads'}</th>
                    <th className="px-3 py-2 text-right font-medium">{s?.depth ?? 'Depth'}</th>
                    <th className="px-3 py-2 text-right font-medium">{s?.time ?? 'Time'}</th>
                    <th className="px-3 py-2 font-medium">{s?.referrers ?? 'Referrers'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posts.map((post) => {
                    const totalRef =
                      post.referrers.direct +
                      post.referrers.google +
                      post.referrers.newsletter +
                      post.referrers.social +
                      post.referrers.other
                    return (
                      <tr key={post.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="max-w-[200px] truncate px-4 py-2 text-gray-300" title={post.title}>
                          {post.title}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-300">{formatNumber(post.views)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatNumber(post.uniqueViews)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatNumber(post.readsComplete)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-400">{post.avgDepth}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-400">{post.avgTime}s</td>
                        <td className="px-3 py-2">
                          {totalRef > 0 ? (
                            <ReferrerBar referrers={post.referrers} total={totalRef} />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Referrer legend */}
            <div className="flex flex-wrap gap-3 border-t border-gray-800 px-4 py-2">
              {(['direct', 'google', 'newsletter', 'social', 'other'] as const).map((key) => (
                <span key={key} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className={`inline-block h-2 w-2 rounded-full ${REFERRER_COLORS[key]}`} />
                  {s?.[key] ?? key}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="flex items-center gap-1.5 text-gray-500">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-200">{value}</p>
    </div>
  )
}

function ReferrerBar({
  referrers,
  total,
}: {
  referrers: { direct: number; google: number; newsletter: number; social: number; other: number }
  total: number
}) {
  const segments = [
    { key: 'direct', value: referrers.direct },
    { key: 'google', value: referrers.google },
    { key: 'newsletter', value: referrers.newsletter },
    { key: 'social', value: referrers.social },
    { key: 'other', value: referrers.other },
  ].filter((s) => s.value > 0)

  return (
    <div className="flex h-2 w-24 overflow-hidden rounded-full bg-gray-800">
      {segments.map((seg) => (
        <div
          key={seg.key}
          className={REFERRER_COLORS[seg.key]}
          style={{ width: `${(seg.value / total) * 100}%` }}
          title={`${seg.key}: ${seg.value}`}
        />
      ))}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
