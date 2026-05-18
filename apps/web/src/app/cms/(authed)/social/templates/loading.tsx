export default function TemplatesLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded-md bg-cms-border" />
          ))}
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-cms-border" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[9/16] animate-pulse rounded-lg bg-cms-border" />
        ))}
      </div>
    </div>
  )
}
