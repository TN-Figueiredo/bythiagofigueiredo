'use client'

import Link from 'next/link'

export interface BlogHealthData {
  totalPosts: number
  totalPostsTrend: number
  published: number
  publishedTrend: number
  avgReadingTime: number
  avgReadingTimeTrend: number
  draftBacklog: number
  draftBacklogTrend: number
  tagBreakdown: Array<{ tagName: string; tagColor: string; count: number }>
  velocitySparkline: number[]
  recentPublications: Array<{
    id: string
    title: string
    tagName: string | null
    tagColor: string | null
    publishedAt: string
  }>
}

function MiniKpi({ label, value, trend }: { label: string; value: number | string; trend?: number }) {
  const trendStr = trend != null && trend !== 0
    ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`
    : null

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-gray-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold tabular-nums text-gray-200">{value}</span>
        {trendStr && (
          <span className={`text-[9px] ${trend! > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trendStr}
          </span>
        )}
      </div>
    </div>
  )
}

export function BlogHealthSection({ data }: { data: BlogHealthData }) {
  const sparklineMax = data.velocitySparkline.length > 0 ? Math.max(...data.velocitySparkline, 1) : 1

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5" data-testid="blog-health">
      <h3 className="mb-4 text-sm font-semibold text-gray-200">Blog Health</h3>

      {/* KPI mini-strip */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniKpi label="Total Posts" value={data.totalPosts} trend={data.totalPostsTrend} />
        <MiniKpi label="Published" value={data.published} trend={data.publishedTrend} />
        <MiniKpi label="Avg Reading" value={`${data.avgReadingTime} min`} trend={data.avgReadingTimeTrend} />
        <MiniKpi label="Draft Backlog" value={data.draftBacklog} trend={data.draftBacklogTrend} />
      </div>

      {/* Tag breakdown + velocity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tag breakdown */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">By Tag</h4>
          <div className="space-y-1.5">
            {data.tagBreakdown.map((tag) => (
              <div key={tag.tagName} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.tagColor }} />
                <span className="flex-1 text-xs text-gray-300">{tag.tagName}</span>
                <span className="text-xs tabular-nums text-gray-500">{tag.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity + Recent */}
        <div>
          {data.velocitySparkline.length >= 2 && (
            <div className="mb-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Velocity</h4>
              <div role="img" aria-label={`Publishing velocity: ${data.velocitySparkline.join(', ')} posts per week`} className="flex h-8 items-end gap-[2px]">
                {data.velocitySparkline.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-indigo-500/40"
                    style={{ height: `${(v / sparklineMax) * 100}%`, minHeight: v > 0 ? '2px' : '0' }}
                  />
                ))}
              </div>
            </div>
          )}
          {data.recentPublications.length > 0 && (
            <div>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Recent</h4>
              <ul className="space-y-1">
                {data.recentPublications.slice(0, 5).map((pub) => (
                  <li key={pub.id}>
                    <Link href={`/cms/blog/${pub.id}/edit`} className="flex items-center gap-2 text-xs text-gray-300 hover:text-gray-100 transition-colors">
                      {pub.tagColor && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: pub.tagColor }} />}
                      <span className="truncate">{pub.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
