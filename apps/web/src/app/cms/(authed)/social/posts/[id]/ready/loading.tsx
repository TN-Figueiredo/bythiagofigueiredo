export default function ReadyToPostLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="space-y-4 w-full max-w-sm">
        <div className="h-6 w-48 animate-pulse rounded-md bg-cms-border mx-auto" />
        <div className="aspect-square w-full animate-pulse rounded-lg bg-cms-border" />
        <div className="h-10 w-full animate-pulse rounded-md bg-cms-border" />
      </div>
    </div>
  )
}
