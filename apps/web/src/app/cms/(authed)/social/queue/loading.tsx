export default function QueueLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded-md bg-cms-border" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-cms-border" />
        ))}
      </div>
    </div>
  )
}
