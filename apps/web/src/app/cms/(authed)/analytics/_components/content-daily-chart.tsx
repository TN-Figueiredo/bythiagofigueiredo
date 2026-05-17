import type { DailyViewPoint } from '@/lib/analytics/content-queries'

interface Props {
  data: DailyViewPoint[]
  compareEnabled: boolean
}

export function ContentDailyChart({ data, compareEnabled }: Props) {
  if (data.length === 0) return null

  const maxVal = Math.max(...data.map(d => Math.max(d.current, d.previous)), 1)
  const w = 560
  const h = 90
  const padX = 30
  const padY = 10
  const chartW = w - padX * 2
  const chartH = h - padY * 2

  const toX = (i: number) => padX + (i / (data.length - 1)) * chartW
  const toY = (v: number) => padY + chartH - (v / maxVal) * chartH

  const currentPoints = data.map((d, i) => `${toX(i)},${toY(d.current)}`).join(' ')
  const areaPath = `M${data.map((d, i) => `${toX(i)},${toY(d.current)}`).join(' L')} L${toX(data.length - 1)},${padY + chartH} L${padX},${padY + chartH} Z`
  const prevPoints = compareEnabled
    ? data.map((d, i) => `${toX(i)},${toY(d.previous)}`).join(' ')
    : ''

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cms-text">Daily Views</h3>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '90px' }} role="img" aria-label="Daily views chart">
        <defs>
          <linearGradient id="contentAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--acc)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#contentAreaGrad)" />
        <polyline points={currentPoints} fill="none" stroke="var(--acc)" strokeWidth="2" />
        {compareEnabled && prevPoints && (
          <polyline points={prevPoints} fill="none" stroke="var(--t5)" strokeWidth="1.5" strokeDasharray="4" />
        )}
      </svg>
    </div>
  )
}
