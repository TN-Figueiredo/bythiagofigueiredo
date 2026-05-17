import { ProgressBarList } from '@/app/cms/(authed)/analytics/_components/progress-bar-list'

interface PlatformClick {
  platform: string
  clicks: number
  postsCount: number
}

interface Props {
  platforms: PlatformClick[]
}

const PLATFORM_COLORS: Record<string, string> = {
  bluesky: '#60a5fa',
  instagram: '#a78bfa',
  facebook: '#FF8240',
  youtube: '#f87171',
}

export function PlatformBreakdown({ platforms }: Props) {
  if (platforms.length === 0) return null

  const totalClicks = platforms.reduce((s, p) => s + p.clicks, 0)

  const best = [...platforms].sort((a, b) => {
    const aRate = a.postsCount > 0 ? a.clicks / a.postsCount : 0
    const bRate = b.postsCount > 0 ? b.clicks / b.postsCount : 0
    return bRate - aRate
  })[0]!

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h4 className="mb-3 text-sm font-semibold text-cms-text">Clicks by Platform</h4>
        <ProgressBarList
          items={platforms.map(p => ({
            label: p.platform,
            value: p.clicks,
            color: PLATFORM_COLORS[p.platform] ?? 'var(--t5)',
            suffix: `(${totalClicks > 0 ? Math.round((p.clicks / totalClicks) * 100) : 0}%)`,
          }))}
        />
      </div>
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h4 className="mb-3 text-sm font-semibold text-cms-text">Clicks/Post by Platform</h4>
        <div className="flex flex-col gap-2">
          {platforms.map(p => (
            <div key={p.platform} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PLATFORM_COLORS[p.platform] ?? 'var(--t5)' }}
                />
                <span className="text-cms-text-muted capitalize">{p.platform}</span>
              </span>
              <span className="font-bold tabular-nums text-cms-text">
                {p.postsCount > 0 ? (p.clicks / p.postsCount).toFixed(1) : '0'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h4 className="mb-3 text-sm font-semibold text-cms-text">Best Platform</h4>
        <div className="flex flex-col items-center justify-center gap-1 py-4">
          <span
            className="text-2xl font-bold capitalize"
            style={{ color: PLATFORM_COLORS[best.platform] ?? 'var(--t5)' }}
          >
            {best.platform}
          </span>
          <span className="text-xs text-cms-text-muted">
            {best.postsCount > 0 ? (best.clicks / best.postsCount).toFixed(1) : '0'} clicks/post avg
          </span>
        </div>
      </div>
    </div>
  )
}
