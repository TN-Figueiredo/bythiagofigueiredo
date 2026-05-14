export default function SocialAccountsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-cms-border pb-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 w-28 animate-pulse rounded-t-md bg-cms-border" />
        ))}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-xl border border-cms-border bg-cms-bg p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <div className="h-8 w-px bg-cms-border" />}
            <div className="space-y-1">
              <div className="h-5 w-8 animate-pulse rounded bg-cms-border" />
              <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
            </div>
          </div>
        ))}
      </div>

      {/* Platform cards grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-cms-border bg-cms-surface">
            {/* Accent bar */}
            <div className="h-[3px] animate-pulse bg-cms-border" />

            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-cms-border" />
                  <div className="h-5 w-24 animate-pulse rounded bg-cms-border" />
                  <div className="h-5 w-14 animate-pulse rounded-full bg-cms-border" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-md bg-cms-border" />
              </div>

              {/* Account card */}
              <div className="rounded-lg bg-cms-bg p-4 space-y-3">
                {/* Avatar row */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-cms-border" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
                      <div className="h-5 w-14 animate-pulse rounded-full bg-cms-border" />
                    </div>
                    <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
                    <div className="h-3 w-28 animate-pulse rounded bg-cms-border" />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="rounded-lg bg-cms-border/30 px-3 py-2 text-center space-y-1">
                      <div className="mx-auto h-4 w-10 animate-pulse rounded bg-cms-border" />
                      <div className="mx-auto h-3 w-14 animate-pulse rounded bg-cms-border" />
                    </div>
                  ))}
                </div>

                {/* Token health bar */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <div className="h-3 w-10 animate-pulse rounded bg-cms-border" />
                    <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
                  </div>
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-cms-border" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
