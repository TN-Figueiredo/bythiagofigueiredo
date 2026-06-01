export default function AbLabLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header + action */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-24 animate-pulse rounded bg-cms-border" />
          <div className="h-3 w-56 animate-pulse rounded bg-cms-border" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 animate-pulse rounded-md bg-cms-border" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-cms-border" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
            <div className="h-7 w-10 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>

      {/* Active tests */}
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-4">
              {/* Thumbnail + title */}
              <div className="flex gap-3">
                <div className="h-16 w-28 shrink-0 animate-pulse rounded-md bg-cms-border" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-cms-border" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-cms-border" />
                </div>
              </div>

              {/* Variant bars */}
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="rounded-lg bg-cms-bg p-3 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-cms-border" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-cms-border" />
                    <div className="flex justify-between">
                      <div className="h-2.5 w-12 animate-pulse rounded bg-cms-border" />
                      <div className="h-2.5 w-10 animate-pulse rounded bg-cms-border" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Completed table */}
      <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
        <div className="border-b border-cms-border bg-cms-bg px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-cms-border px-4 py-3 last:border-0">
            <div className="h-10 w-16 shrink-0 animate-pulse rounded-md bg-cms-border" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-cms-border" />
            </div>
            <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-cms-border" />
            <div className="h-5 w-14 shrink-0 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
