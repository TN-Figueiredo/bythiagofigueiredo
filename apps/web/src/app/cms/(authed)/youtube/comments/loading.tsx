export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-cms-surface-hover" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-cms-surface-hover" />
        ))}
      </div>
    </div>
  )
}
