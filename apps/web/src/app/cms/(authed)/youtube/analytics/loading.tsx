export default function YouTubeAnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Channel selector */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-40 animate-pulse rounded-md bg-cms-border" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-cms-surface border border-cms-border p-4 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
            <div className="h-7 w-14 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-14 animate-pulse rounded-md bg-cms-border" />
            ))}
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Two-column: grades table + search terms */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Video grades */}
        <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-3">
          <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-16 shrink-0 animate-pulse rounded-md bg-cms-border" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-cms-border" />
                <div className="h-2 w-full animate-pulse rounded-full bg-cms-border" />
              </div>
              <div className="h-6 w-8 shrink-0 animate-pulse rounded bg-cms-border" />
            </div>
          ))}
        </div>

        {/* Search terms */}
        <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
              <div className="h-3 w-12 animate-pulse rounded bg-cms-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Demographics */}
      <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
              <div className="h-4 w-8 animate-pulse rounded bg-cms-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
