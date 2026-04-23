'use client'

import { Heatmap } from './heatmap'

interface ContentTabProps {
  period: string
}

function generateHeatmapCells(weeks: number) {
  const cells: { date: string; count: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]!
    // Simulate publishing activity — weekdays more active
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const rand = Math.random()
    const count = isWeekend
      ? rand < 0.85 ? 0 : 1
      : rand < 0.45 ? 0 : rand < 0.7 ? 1 : rand < 0.88 ? 2 : 3
    cells.push({ date: dateStr, count })
  }
  return cells
}

const HEATMAP_CELLS = generateHeatmapCells(12)

const AUTHORS = [
  { name: 'Thiago Figueiredo', handle: 'tnFigueiredo', posts: 28, published: 22, drafts: 6, avatar: 'TF' },
  { name: 'Guest Author A', handle: 'guest_a', posts: 7, published: 7, drafts: 0, avatar: 'GA' },
  { name: 'Guest Author B', handle: 'guest_b', posts: 3, published: 2, drafts: 1, avatar: 'GB' },
]

const CONTENT_STATS = [
  { label: 'Total Posts', value: '38', note: '30 published' },
  { label: 'Total Campaigns', value: '5', note: '4 active' },
  { label: 'Avg. Reading Time', value: '6m', note: 'blog posts' },
  { label: 'Locales', value: '2', note: 'pt-BR + en' },
]

export function ContentTab({ period: _period }: ContentTabProps) {
  return (
    <div className="space-y-6">
      {/* Content stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CONTENT_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4"
          >
            <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
              {stat.label}
            </div>
            <div className="text-2xl font-semibold text-cms-text mt-1">{stat.value}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--cms-text-muted, #71717a)' }}>
              {stat.note}
            </div>
          </div>
        ))}
      </div>

      {/* Publishing heatmap */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
        <h3 className="text-sm font-medium text-cms-text mb-4">Publishing Activity</h3>
        <Heatmap cells={HEATMAP_CELLS} weeks={12} label="publications" />
      </div>

      {/* Author leaderboard */}
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-5">
        <h3 className="text-sm font-medium text-cms-text mb-3">Author Leaderboard</h3>
        <div className="space-y-2">
          {AUTHORS.map((author, idx) => (
            <div
              key={author.handle}
              className="flex items-center gap-3 text-xs py-2.5 border-b border-cms-border last:border-0"
            >
              {/* Rank */}
              <span
                className="text-[11px] tabular-nums w-5 shrink-0 text-right"
                style={{ color: 'var(--cms-text-dim, #52525b)' }}
              >
                {idx + 1}
              </span>
              {/* Avatar */}
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: 'var(--cms-accent-subtle, rgba(99,102,241,.18))', color: 'var(--cms-accent, #6366f1)' }}
              >
                {author.avatar}
              </span>
              {/* Name + handle */}
              <div className="flex-1 min-w-0">
                <div className="text-cms-text font-medium truncate">{author.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
                  @{author.handle}
                </div>
              </div>
              {/* Stats */}
              <div className="flex gap-4 shrink-0 text-right">
                <div>
                  <div className="text-cms-text font-semibold tabular-nums">{author.posts}</div>
                  <div style={{ color: 'var(--cms-text-dim, #52525b)' }}>total</div>
                </div>
                <div>
                  <div className="tabular-nums font-medium" style={{ color: 'var(--cms-green, #22c55e)' }}>
                    {author.published}
                  </div>
                  <div style={{ color: 'var(--cms-text-dim, #52525b)' }}>pub</div>
                </div>
                <div>
                  <div className="tabular-nums" style={{ color: 'var(--cms-amber, #f59e0b)' }}>
                    {author.drafts}
                  </div>
                  <div style={{ color: 'var(--cms-text-dim, #52525b)' }}>draft</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
