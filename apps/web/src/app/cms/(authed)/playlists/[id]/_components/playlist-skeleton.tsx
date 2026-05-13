export function PlaylistEditorSkeleton() {
  return (
    <div className="flex h-full flex-col bg-[#0a0a12]">
      {/* Toolbar skeleton */}
      <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-14 animate-pulse rounded-md bg-white/10" />
        </div>
        <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-7 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="flex w-64 flex-col border-r border-white/10">
          <div className="border-b border-white/10 px-3 py-2">
            <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
          </div>
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-white/10" />
                <div className="h-3 w-full animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Canvas skeleton */}
        <div className="relative flex-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-20 w-40 animate-pulse rounded-xl border-2 border-white/5 bg-white/[0.03]"
              style={{
                left: `${120 + i * 220}px`,
                top: `${80 + (i % 2) * 100}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PlaylistEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 text-4xl opacity-20">&#127925;</div>
      <h3 className="text-lg font-semibold text-white/60">Empty playlist</h3>
      <p className="mt-1 max-w-xs text-sm text-white/30">
        Use the sidebar to add blog posts, newsletters, or pipeline items. Then connect them with edges to define the reading order.
      </p>
    </div>
  )
}
