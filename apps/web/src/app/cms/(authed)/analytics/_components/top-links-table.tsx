import type { ClickedLink } from '../types'
import { linkTypeBadgeColor, linkTypeLabel } from '@/lib/analytics/link-classifier'

function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url
  return url.slice(0, max - 3) + '...'
}

interface Props {
  links: ClickedLink[]
}

export function TopLinksTable({ links }: Props) {
  if (links.length === 0) {
    return (
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="text-sm font-medium text-cms-text-dim">Top Links</h3>
        <p className="mt-3 text-sm text-cms-text-muted">No link clicks in this period.</p>
      </div>
    )
  }

  const maxClicks = Math.max(...links.map((l) => l.clicks), 1)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4" data-testid="top-links-table">
      <h3 className="mb-3 text-sm font-medium text-cms-text-dim">Top Links</h3>
      <div className="space-y-2">
        {links.map((link, i) => {
          const badgeColor = linkTypeBadgeColor(link.linkType)
          const shareWidth = Math.round((link.clicks / maxClicks) * 100)

          return (
            <div
              key={`${link.url}-${i}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-cms-border/30"
            >
              {/* Type badge */}
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: badgeColor }}
              >
                {linkTypeLabel(link.linkType)}
              </span>

              {/* URL */}
              <span
                className="min-w-0 flex-1 truncate text-sm text-cms-text"
                title={link.url}
              >
                {truncateUrl(link.url)}
              </span>

              {/* Click count */}
              <span className="shrink-0 text-sm font-medium tabular-nums text-cms-text">
                {link.clicks}
              </span>

              {/* Source */}
              <span className="shrink-0 text-xs text-cms-text-muted">
                {link.topSource}
              </span>

              {/* Share bar */}
              <div className="hidden w-16 shrink-0 sm:block">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-cms-border">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${shareWidth}%`, backgroundColor: badgeColor }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
