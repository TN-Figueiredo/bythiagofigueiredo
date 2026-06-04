'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function BlogEditorError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center p-8 text-cms-text">
      <h2 className="text-lg font-semibold mb-2">Editor error</h2>
      <pre className="mb-4 max-w-xl overflow-auto rounded-lg bg-red-950/40 p-4 text-xs text-red-300 whitespace-pre-wrap">
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      <button onClick={reset} className="px-4 py-2 bg-cms-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
        Tentar novamente
      </button>
    </div>
  )
}
