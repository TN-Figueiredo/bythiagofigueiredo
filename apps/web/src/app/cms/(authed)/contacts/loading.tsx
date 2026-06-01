export default function ContactsLoading() {
  return (
    <div>
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
        <div className="h-5 w-20 animate-pulse rounded bg-cms-border" />
        <div className="h-4 w-14 animate-pulse rounded bg-cms-border" />
      </div>

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
              <div className="h-6 w-10 animate-pulse rounded bg-cms-border" />
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-56 animate-pulse rounded-md bg-cms-border" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-cms-border" />
        </div>

        {/* Submissions table */}
        <div className="rounded-xl border border-cms-border bg-cms-surface overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 border-b border-cms-border bg-cms-bg px-4 py-3">
            {['Name', 'Email', 'Message', 'Date', 'Status'].map((col) => (
              <div key={col} className="h-3 w-16 animate-pulse rounded bg-cms-border" />
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 border-b border-cms-border px-4 py-3 last:border-0"
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-2 w-36 shrink-0">
                <div className="h-8 w-8 animate-pulse rounded-full bg-cms-border" />
                <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
              </div>
              {/* Email */}
              <div className="h-3 w-40 animate-pulse rounded bg-cms-border" />
              {/* Message snippet */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="h-3 w-full animate-pulse rounded bg-cms-border" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
              </div>
              {/* Date */}
              <div className="h-3 w-20 shrink-0 animate-pulse rounded bg-cms-border" />
              {/* Status badge */}
              <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-cms-border" />
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-cms-border" />
          <div className="flex gap-2">
            <div className="h-8 w-8 animate-pulse rounded-md bg-cms-border" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-cms-border" />
          </div>
        </div>
      </div>
    </div>
  )
}
