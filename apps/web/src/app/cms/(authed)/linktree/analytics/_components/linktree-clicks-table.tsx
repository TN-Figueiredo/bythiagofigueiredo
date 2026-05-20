'use client'

interface Props {
  clicksByKey: Record<string, number>
  totalClicks: number
}

type BadgeStyle = { bg: string; text: string; label: string }

function getBadge(linkKey: string): BadgeStyle {
  if (linkKey === 'highlight') return { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Highlight' }
  if (
    linkKey.startsWith('blog:pt:') ||
    linkKey.startsWith('newsletter:pt:') ||
    linkKey.startsWith('youtube:pt:')
  )
    return { bg: 'bg-green-500/10', text: 'text-green-400', label: 'PT' }
  if (
    linkKey.startsWith('blog:en:') ||
    linkKey.startsWith('newsletter:en:') ||
    linkKey.startsWith('youtube:en:')
  )
    return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', label: 'EN' }
  if (linkKey.startsWith('latest:'))
    return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', label: "What's New" }
  if (linkKey.startsWith('shared:'))
    return { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Shared' }
  if (linkKey.startsWith('social:'))
    return { bg: 'bg-rose-500/10', text: 'text-rose-400', label: 'Social' }
  return { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Other' }
}

function formatLinkLabel(linkKey: string): string {
  if (linkKey === 'highlight') return 'Highlight Card'
  const parts = linkKey.split(':')
  if (parts[0] === 'social') return (parts[1] ?? '').charAt(0).toUpperCase() + (parts[1] ?? '').slice(1)
  if (parts[0] === 'shared') return `Shared Link (${(parts[1] ?? '').slice(0, 8)}...)`
  if (parts[0] === 'latest') return `${parts[1] === 'blog' ? 'Blog' : 'YouTube'}: ${parts.slice(2).join(':')}`
  if (parts[0] === 'blog' || parts[0] === 'newsletter' || parts[0] === 'youtube')
    return parts.slice(2).join(':')
  return linkKey
}

export function LinktreeClicksTable({ clicksByKey, totalClicks }: Props) {
  const sorted = Object.entries(clicksByKey).sort((a, b) => b[1] - a[1])

  const maxCount = sorted[0]?.[1] ?? 1

  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="w-8 px-3 py-2 text-muted-foreground">#</th>
            <th className="px-3 py-2 text-muted-foreground">Link</th>
            <th className="px-3 py-2 text-muted-foreground">Seção</th>
            <th className="w-48 px-3 py-2 text-muted-foreground">%</th>
            <th className="w-16 px-3 py-2 text-right text-muted-foreground">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([key, count], i) => {
            const badge = getBadge(key)
            const pct = totalClicks > 0 ? (count / totalClicks) * 100 : 0
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
            return (
              <tr key={key} className="border-b border-border/50 last:border-b-0">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground">{formatLinkLabel(key)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[10px] text-muted-foreground">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-medium text-foreground">{count}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-card">
            <td className="px-3 py-2" colSpan={4}>
              <span className="font-medium text-muted-foreground">Total</span>
            </td>
            <td className="px-3 py-2 text-right font-bold text-foreground">{totalClicks}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
