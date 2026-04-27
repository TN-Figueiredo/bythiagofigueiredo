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
    const result = await renderPreview(editionId)
    if (result.ok) {
      setHtml(result.html)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [editionId, renderPreview])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-medium text-gray-700">Email Preview</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWidth('desktop')}
            className={`px-2 py-1 text-xs rounded ${width === 'desktop' ? 'bg-gray-200 font-medium' : 'text-gray-500'}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setWidth('mobile')}
            className={`px-2 py-1 text-xs rounded ${width === 'mobile' ? 'bg-gray-200 font-medium' : 'text-gray-500'}`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-600">{error === 'no_content' ? 'No content to preview. Start writing!' : error}</p>
          </div>
        )}
        {html && !error && (
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
          <p className="text-sm text-gray-500 py-8">Click Refresh to load preview</p>
        )}
      </div>
    </div>
  )
}
