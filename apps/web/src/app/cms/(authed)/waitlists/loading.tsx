export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6 p-6">
      <span className="sr-only">Loading waitlists…</span>
      <div className="h-8 w-40 animate-pulse motion-reduce:animate-none rounded-[var(--cms-radius)] bg-cms-surface" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse motion-reduce:animate-none rounded-[var(--cms-radius)] bg-cms-surface" />
        ))}
      </div>
      <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-b border-cms-border px-4 py-4 last:border-0">
            <div className="h-8 w-full animate-pulse motion-reduce:animate-none rounded bg-cms-surface-hover" />
          </div>
        ))}
      </div>
    </div>
  )
}
