'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function StoriesError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div role="alert" aria-live="assertive" className="rounded-lg bg-cms-surface p-6 text-center shadow-lg max-w-md">
        <h2 className="text-lg font-semibold text-cms-text">Something went wrong</h2>
        <p className="mt-2 text-sm text-cms-text-muted">An unexpected error occurred. Please try again.</p>
        <details className="mt-3 text-left text-xs text-cms-text-muted">
          <summary className="cursor-pointer">Technical details</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
