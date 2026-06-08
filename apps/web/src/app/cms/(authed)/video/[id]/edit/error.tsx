'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h2 style={{ color: 'var(--danger)' }}>Erro ao carregar o vídeo</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{error.message}</pre>
      <button className="btn sm primary" onClick={reset}>Tentar novamente</button>
    </div>
  )
}
