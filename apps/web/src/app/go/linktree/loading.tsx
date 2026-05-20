export default function LinktreeLoading() {
  return (
    <main className="min-h-dvh bg-[var(--pb-bg)] px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-[400px] flex flex-col gap-3 animate-pulse">
        <div className="flex justify-end gap-2">
          <div className="w-16 h-7 rounded-full bg-[var(--pb-paper)]" />
          <div className="w-9 h-9 rounded-full bg-[var(--pb-paper)]" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-full bg-[var(--pb-paper)]" />
          <div className="w-32 h-4 rounded bg-[var(--pb-paper)]" />
          <div className="w-48 h-3 rounded bg-[var(--pb-paper)]" />
        </div>
        <div className="h-28 rounded-sm bg-[var(--pb-paper)]" />
        <div className="h-40 rounded-sm bg-[var(--pb-paper)]" />
        <div className="h-40 rounded-sm bg-[var(--pb-paper)]" />
      </div>
    </main>
  )
}
