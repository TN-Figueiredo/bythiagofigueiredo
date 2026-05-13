export default function SocialDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Content card */}
      <div className="rounded-lg bg-cms-surface p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-3/4 animate-pulse rounded bg-cms-border" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-cms-border" />
          </div>
          <div className="h-8 w-20 animate-pulse rounded-md bg-cms-border" />
        </div>
        <div className="h-32 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Delivery cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-cms-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 animate-pulse rounded-full bg-cms-border" />
              <div className="h-4 w-24 animate-pulse rounded bg-cms-border" />
            </div>
            <div className="h-4 w-16 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-32 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-lg bg-cms-surface p-6 space-y-4">
        <div className="h-4 w-20 animate-pulse rounded bg-cms-border" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-3 w-3 mt-1 animate-pulse rounded-full bg-cms-border shrink-0" />
            <div className="space-y-1 flex-1">
              <div className="h-3 w-40 animate-pulse rounded bg-cms-border" />
              <div className="h-3 w-24 animate-pulse rounded bg-cms-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
