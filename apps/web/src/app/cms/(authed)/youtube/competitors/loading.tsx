export default function CompetitorsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-64 animate-pulse rounded bg-cms-surface-hover" />
        <div className="h-4 w-16 animate-pulse rounded bg-cms-surface-hover" />
      </div>
      <div className="flex gap-1 border-b border-cms-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded bg-cms-surface-hover" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-cms-surface-hover" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-cms-surface-hover" />
        ))}
      </div>
    </div>
  )
}
