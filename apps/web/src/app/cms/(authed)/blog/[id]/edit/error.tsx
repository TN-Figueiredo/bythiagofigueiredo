'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function BlogEditorError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
        Erro no editor
      </h2>
      <pre style={{
        marginBottom: 16, maxWidth: 560, overflow: 'auto', borderRadius: 12,
        background: 'var(--danger-s)', padding: 16, fontSize: 12, color: 'var(--text-muted)',
        whiteSpace: 'pre-wrap',
      }}>
        {error.message}
        {process.env.NODE_ENV !== 'production' && (
          <>{'\n'}{error.stack}</>
        )}
      </pre>
      <button onClick={reset} className="btn sm primary">
        Tentar novamente
      </button>
    </div>
  )
}
