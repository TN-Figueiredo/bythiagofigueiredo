export default function SocialLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-cms-border" />
          ))}
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-cms-border" />
        ))}
      </div>
    </div>
  )
}
