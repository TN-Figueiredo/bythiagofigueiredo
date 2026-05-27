'use client'

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded ${className}`}
      style={{ background: 'var(--gem-faint)' }}
    />
  )
}

export function CommandCenterSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando command center">
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-6 w-48" />
        <Pulse className="h-8 w-40 rounded-md" />
      </div>

      <Pulse className="h-1.5 w-full rounded-full" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Pulse className="h-20 w-full rounded-lg" />
        <Pulse className="h-20 w-full rounded-lg" />
      </div>

      <Pulse className="h-10 w-full rounded-lg" />

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--gem-border)' }}
      >
        <div className="grid grid-cols-7 min-w-[600px]">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="border-r last:border-r-0 min-h-[80px] p-2 space-y-2" style={{ borderColor: 'var(--gem-border)' }}>
              <Pulse className="h-3 w-8 mx-auto" />
              <Pulse className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Pulse className="h-10 w-full rounded-lg" />
        <Pulse className="h-10 w-full rounded-lg" />
        <Pulse className="h-10 w-full rounded-lg" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Pulse key={i} className="h-3 w-3 rounded-full" />
        ))}
      </div>
    </div>
  )
}
