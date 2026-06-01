export default function SettingsLoading() {
  return (
    <div>
      {/* Topbar */}
      <div className="flex items-center border-b border-cms-border px-6 py-4">
        <div className="h-5 w-16 animate-pulse rounded bg-cms-border" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar nav */}
        <div className="w-52 shrink-0 border-r border-cms-border p-4 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-md bg-cms-border" />
          ))}
        </div>

        {/* Content pane */}
        <div className="flex-1 p-6 space-y-6">
          {/* Section heading */}
          <div className="space-y-1.5">
            <div className="h-5 w-36 animate-pulse rounded bg-cms-border" />
            <div className="h-3 w-64 animate-pulse rounded bg-cms-border" />
          </div>

          {/* Form fields */}
          <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-cms-border" />
                <div className="h-9 w-full animate-pulse rounded-md bg-cms-border" />
              </div>
            ))}
          </div>

          {/* Second card */}
          <div className="rounded-xl border border-cms-border bg-cms-surface p-5 space-y-4">
            <div className="h-4 w-28 animate-pulse rounded bg-cms-border" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-20 animate-pulse rounded bg-cms-border" />
                  <div className="h-9 w-full animate-pulse rounded-md bg-cms-border" />
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <div className="h-9 w-28 animate-pulse rounded-md bg-cms-border" />
          </div>
        </div>
      </div>
    </div>
  )
}
