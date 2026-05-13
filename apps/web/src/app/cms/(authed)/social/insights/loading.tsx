export default function SocialInsightsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-cms-surface p-4 space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
            <div className="h-7 w-12 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-lg bg-cms-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-14 animate-pulse rounded-md bg-cms-border" />
            ))}
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Heatmap */}
      <div className="rounded-lg bg-cms-surface p-6 space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-cms-border" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 49 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-sm bg-cms-border" />
          ))}
        </div>
      </div>
    </div>
  )
}
