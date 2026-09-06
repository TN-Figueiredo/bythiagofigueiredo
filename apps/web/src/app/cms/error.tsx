'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Error boundary for everything under /cms (including the (authed) layout).
//
// Without this file a CMS failure falls through to app/global-error.tsx, whose
// only action is `reset()` — a client re-render. That dead-ends the one failure
// class we actually hit in production (2026-09-05): a tab that kept the client
// bundle of an OLDER deployment (Next 15) navigating against the NEW server
// (Next 16.3) — "The router state header was sent but could not be parsed".
// Re-rendering a stale client never recovers; only a full document load does.
// Hence the primary action here is a hard reload, and `reset()` is secondary.
export default function CmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: 'cms', boundary: 'error' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold mb-2">Something went wrong in the CMS</h1>
        <p className="text-sm text-muted-foreground mb-1">
          The error has been reported. If you kept this tab open across a deploy, the page is
          running an outdated build — reloading fixes it.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70 mb-5 font-mono">ref {error.digest}</p>
        ) : (
          <div className="mb-5" />
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium px-4 py-2 rounded-md bg-foreground text-background hover:opacity-90"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
