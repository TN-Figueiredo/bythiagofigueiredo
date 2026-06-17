'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Segment error boundary for the waitlists CMS (list + detail). The query layer already
 * logs + Sentry-captures the redacted error; this renders a graceful, cms-token fallback
 * with a retry instead of the framework's generic crash screen. Detail (loadWaitlistDetail)
 * rethrows into here; the list page has its own inline fallback.
 */
export default function WaitlistsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The thrown error is already observed in the query layer; avoid re-logging PII here.
  }, [error])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-cms-text">Waitlists</h1>
        <p className="mt-0.5 text-sm text-cms-text-muted">Launch-notification signup lists</p>
      </div>
      <div
        role="alert"
        className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface px-6 py-10 text-center"
      >
        <AlertTriangle size={28} className="mb-3 text-cms-text-muted" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-cms-text">Couldn&apos;t load this waitlist</h3>
        <p className="mt-1 text-xs text-cms-text-muted">Something went wrong. Try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
