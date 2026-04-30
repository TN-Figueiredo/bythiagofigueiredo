'use client'

import { useState, useEffect, useCallback } from 'react'

interface EmailPreviewProps {
  editionId: string
  renderPreview: (editionId: string) => Promise<{ ok: true; html: string } | { ok: false; error: string }>
}

export function EmailPreview({ editionId, renderPreview }: EmailPreviewProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await renderPreview(editionId)
      if (result.ok) {
        setHtml(result.html)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to render preview')
    } finally {
      setLoading(false)
    }
  }, [editionId, renderPreview])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-[var(--border,#e5e7eb)] px-4 py-2">
        <h3 className="text-sm font-medium text-[var(--text-secondary,#6b7280)]">Email Preview</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWidth('desktop')}
            className={`px-2 py-1 text-xs rounded ${width === 'desktop' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-[var(--text-tertiary,#9ca3af)]'}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setWidth('mobile')}
            className={`px-2 py-1 text-xs rounded ${width === 'mobile' ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-[var(--text-tertiary,#9ca3af)]'}`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="px-2 py-1 text-xs text-purple-400 hover:text-purple-300"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[var(--bg,#f3f4f6)] p-4 flex justify-center">
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-400">{error === 'no_content' ? 'No content to preview. Start writing!' : error}</p>
          </div>
        )}
        {loading && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-tertiary,#9ca3af)]">Rendering preview...</p>
          </div>
        )}
        {html && !error && !loading && (
          <iframe
            srcDoc={html}
            title="Email preview"
            className="bg-white shadow-md rounded border-0"
            style={{
              width: width === 'desktop' ? '600px' : '375px',
              height: '100%',
              minHeight: '500px',
              transition: 'width 0.2s ease',
            }}
            sandbox="allow-same-origin"
          />
        )}
        {!html && !error && !loading && (
          <p className="text-sm text-[var(--text-tertiary,#9ca3af)] py-8">Click Refresh to load preview</p>
        )}
      </div>
    </div>
  )
}
