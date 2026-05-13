'use client'

import type { SocialStrings } from '../../_i18n/types'

interface LeaderboardItem {
  id: string
  label: string
  value: number
  thumbnailUrl?: string
  badge?: string
}

interface InsightsBestOfProps {
  topThumbnails: LeaderboardItem[]
  topTitles: LeaderboardItem[]
  topPosts: LeaderboardItem[]
  strings: SocialStrings
}

export function InsightsBestOf({ topThumbnails, topTitles, topPosts, strings: t }: InsightsBestOfProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Podium title={t.insights.bestOf.topThumbnails} items={topThumbnails} unit="% CTR" />
      <Podium title={t.insights.bestOf.topTitles} items={topTitles} unit="% CTR" />
      <Podium title={t.insights.bestOf.topPosts} items={topPosts} unit=" clicks" />
    </div>
  )
}

function Podium({ title, items, unit }: { title: string; items: LeaderboardItem[]; unit: string }) {
  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h3 className="text-sm font-semibold text-cms-text mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-cms-text-dim py-4 text-center">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>
                {i + 1}
              </span>
              {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded object-cover" />}
              <span className="flex-1 text-sm text-cms-text truncate">{item.label}</span>
              <span className="text-xs font-medium text-cms-accent">{item.value}{unit}</span>
              {item.badge && <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-400">{item.badge}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
