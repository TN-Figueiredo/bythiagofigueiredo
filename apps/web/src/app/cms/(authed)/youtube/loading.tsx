export default function YouTubeDashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Channel cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-cms-border bg-cms-surface space-y-4 p-5">
            {/* Channel header */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-cms-border" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 animate-pulse rounded bg-cms-border" />
                <div className="h-3 w-24 animate-pulse rounded bg-cms-border" />
              </div>
              <div className="h-7 w-20 animate-pulse rounded-md bg-cms-border" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-lg bg-cms-bg p-3 space-y-1 text-center">
                  <div className="mx-auto h-5 w-12 animate-pulse rounded bg-cms-border" />
                  <div className="mx-auto h-3 w-16 animate-pulse rounded bg-cms-border" />
                </div>
              ))}
            </div>

            {/* Sync status bar */}
            <div className="flex items-center justify-between rounded-lg bg-cms-bg px-4 py-2">
              <div className="h-3 w-28 animate-pulse rounded bg-cms-border" />
              <div className="h-6 w-20 animate-pulse rounded-md bg-cms-border" />
            </div>
          </div>
        ))}
      </div>

      {/* Uncategorized banner */}
      <div className="h-12 animate-pulse rounded-lg bg-cms-border" />

      {/* Recent sync log */}
      <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 animate-pulse rounded-full bg-cms-border" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
            <div className="ml-auto h-3 w-20 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
