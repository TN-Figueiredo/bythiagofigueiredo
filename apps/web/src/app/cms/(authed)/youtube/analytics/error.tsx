'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center p-8 text-cms-text">
      <h2 className="text-lg font-semibold mb-2">Algo deu errado</h2>
      <p className="text-cms-text-muted mb-4 text-sm">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-cms-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
        Tentar novamente
      </button>
    </div>
  )
}
