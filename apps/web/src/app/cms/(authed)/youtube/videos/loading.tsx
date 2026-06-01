export default function YouTubeVideosLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Toolbar: filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-cms-border" />
        <div className="h-8 w-32 animate-pulse rounded-md bg-cms-border" />
        <div className="h-8 w-32 animate-pulse rounded-md bg-cms-border" />
        <div className="ml-auto h-8 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-cms-border bg-cms-bg px-4 py-3">
          <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
          <div className="h-3 w-24 animate-pulse rounded bg-cms-border" />
          <div className="ml-auto flex gap-6">
            <div className="h-3 w-14 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-14 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-14 animate-pulse rounded bg-cms-border" />
          </div>
        </div>

        {/* Video rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-cms-border px-4 py-3 last:border-0"
          >
            {/* Thumbnail */}
            <div className="h-14 w-24 shrink-0 animate-pulse rounded-md bg-cms-border" />

            {/* Title + meta */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-3/4 animate-pulse rounded bg-cms-border" />
              <div className="flex gap-2">
                <div className="h-3 w-16 animate-pulse rounded bg-cms-border" />
                <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
              </div>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex gap-6 shrink-0">
              <div className="h-4 w-12 animate-pulse rounded bg-cms-border" />
              <div className="h-4 w-10 animate-pulse rounded bg-cms-border" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-cms-border" />
            </div>

            {/* Actions */}
            <div className="h-7 w-7 animate-pulse rounded bg-cms-border" />
          </div>
        ))}
      </div>
    </div>
  )
}
