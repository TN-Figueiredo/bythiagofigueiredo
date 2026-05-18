export default function StoriesLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-cms-border" />
          <div className="h-4 w-56 animate-pulse rounded bg-cms-border" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-cms-border pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded bg-cms-border mb-2" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-cms-border bg-cms-surface">
            <div
              className="animate-pulse bg-cms-border"
              style={{ paddingTop: '177.78%' }}
            />
            <div className="space-y-2 p-3">
              <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-cms-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
