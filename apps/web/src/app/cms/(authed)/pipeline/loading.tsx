export default function PipelineOverviewLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Topbar */}
      <div className="h-10 w-28 animate-pulse rounded-md bg-cms-border" />

      {/* Up Next week grid */}
      <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 animate-pulse rounded bg-cms-border" />
          <div className="h-3 w-32 animate-pulse rounded bg-cms-border" />
        </div>
        {/* Day columns */}
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-10 animate-pulse rounded bg-cms-border" />
              <div className="rounded-lg bg-cms-bg p-3 space-y-2 min-h-[72px]">
                <div className="h-3 w-full animate-pulse rounded bg-cms-border" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
                <div className="h-4 w-14 animate-pulse rounded-full bg-cms-border" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: celebration + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent celebrations */}
        <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-cms-border" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 animate-pulse rounded bg-cms-border" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-cms-border" />
              </div>
              <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-cms-border" />
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-cms-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cms-border" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
              <div className="ml-auto h-3 w-14 animate-pulse rounded bg-cms-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
