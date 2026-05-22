export default function NewStoryLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded bg-cms-border" />
        <div className="h-6 w-48 animate-pulse rounded bg-cms-border" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="aspect-[9/16] max-h-[600px] animate-pulse rounded-xl bg-cms-border" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-20 animate-pulse rounded-md bg-cms-border" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-cms-surface p-4 space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-cms-border" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-cms-border" />
            ))}
          </div>
          <div className="rounded-lg bg-cms-surface p-4 space-y-3">
            <div className="h-4 w-20 animate-pulse rounded bg-cms-border" />
            <div className="h-10 animate-pulse rounded-md bg-cms-border" />
          </div>
        </div>
      </div>
    </div>
  )
}
