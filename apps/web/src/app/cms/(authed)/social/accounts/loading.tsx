export default function SocialAccountsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-cms-border pb-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-8 w-28 animate-pulse rounded-t-md bg-cms-border" />
        ))}
      </div>

      {/* Platform cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-cms-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-cms-border" />
                <div className="space-y-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-cms-border" />
                  <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
                </div>
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-cms-border" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 animate-pulse rounded-md bg-cms-border" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-cms-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
