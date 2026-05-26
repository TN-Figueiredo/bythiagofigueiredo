'use client'

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--gem-faint)' }}
    />
  )
}

export function CommandCenterSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando command center">
      <div className="flex items-center gap-3">
        <Pulse className="h-6 w-48" />
        <Pulse className="h-4 w-24" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Pulse className="h-24 w-full" />
        <Pulse className="h-24 w-full" />
      </div>

      <Pulse className="h-32 w-full" />

      <div className="space-y-2">
        <Pulse className="h-8 w-full" />
        <Pulse className="h-8 w-full" />
      </div>
    </div>
  )
}
