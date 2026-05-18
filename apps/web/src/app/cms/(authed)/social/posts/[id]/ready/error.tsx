'use client'

export default function ReadyToPostError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div role="alert" className="rounded-lg bg-cms-surface p-6 text-center shadow-lg max-w-md">
        <h2 className="text-lg font-semibold text-cms-text">Something went wrong</h2>
        <p className="mt-2 text-sm text-cms-text-muted">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
