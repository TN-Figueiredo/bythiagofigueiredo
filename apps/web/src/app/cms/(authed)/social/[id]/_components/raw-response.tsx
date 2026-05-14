'use client'

import { useState, useCallback } from 'react'

interface RawResponseProps {
  data: Record<string, unknown>
}

export function RawResponse({ data }: RawResponseProps) {
  const [expanded, setExpanded] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }, [data])

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 text-left text-xs font-medium text-cms-text-muted hover:text-cms-text"
      >
        {expanded ? 'Ocultar resposta raw' : 'Mostrar resposta raw'}
      </button>
      {expanded && (
        <div className="relative border-t border-cms-border">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 rounded px-2 py-1 text-[9px] font-medium text-cms-text-muted hover:text-cms-text border border-cms-border bg-cms-bg"
          >
            Copiar JSON
          </button>
          <pre
            data-testid="raw-json"
            className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-cms-text bg-cms-bg/50"
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
