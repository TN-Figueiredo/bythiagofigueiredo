export default function LinksDashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-cms-border pb-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-t-md bg-cms-border mb-2" />
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
            <div className="h-6 w-14 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-cms-border" />
        <div className="h-8 w-32 animate-pulse rounded-md bg-cms-border" />
        <div className="ml-auto h-9 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Links table */}
      <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-cms-border bg-cms-bg px-4 py-3">
          <div className="h-3 w-12 animate-pulse rounded bg-cms-border" />
          <div className="h-3 w-32 animate-pulse rounded bg-cms-border" />
          <div className="ml-auto flex gap-6">
            <div className="h-3 w-12 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-12 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-cms-border px-4 py-3 last:border-0"
          >
            {/* Status dot + slug */}
            <div className="flex items-center gap-2 w-40 shrink-0">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cms-border" />
              <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
            </div>

            {/* Title + dest */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-4 w-2/3 animate-pulse rounded bg-cms-border" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-cms-border" />
            </div>

            {/* Sparkline placeholder */}
            <div className="hidden lg:block h-8 w-24 animate-pulse rounded bg-cms-border" />

            {/* Stats */}
            <div className="hidden sm:flex gap-6 shrink-0">
              <div className="h-4 w-10 animate-pulse rounded bg-cms-border" />
              <div className="h-4 w-10 animate-pulse rounded bg-cms-border" />
            </div>

            {/* Badge + menu */}
            <div className="h-5 w-14 animate-pulse rounded-full bg-cms-border" />
            <div className="h-7 w-7 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
