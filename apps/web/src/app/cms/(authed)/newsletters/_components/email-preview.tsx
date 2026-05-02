'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil } from 'lucide-react'

interface EmailPreviewProps {
  editionId: string
  renderPreview: (editionId: string) => Promise<{ ok: true; html: string } | { ok: false; error: string }>
  onSendTest?: () => void
  onBack?: () => void
}

export function EmailPreview({ editionId, renderPreview, onSendTest, onBack }: EmailPreviewProps) {
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
      <div className="flex items-center justify-between border-b border-[#1f2937] bg-[#030712] px-4 py-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-indigo-500/30 rounded-md text-[#818cf8] hover:bg-indigo-500/10"
            >
              <Pencil size={12} /> Editor
            </button>
          )}
          <h3 className="text-sm font-medium text-[#9ca3af]">Email Preview</h3>
        </div>
        <div className="flex items-center gap-2">
          {onSendTest && (
            <button
              type="button"
              onClick={onSendTest}
              className="px-2 py-1 text-xs text-[#818cf8] hover:text-[#a5b4fc]"
            >
              Send Test
            </button>
          )}
          <button
            type="button"
            onClick={() => setWidth('desktop')}
            className={`px-2 py-1 text-xs rounded ${width === 'desktop' ? 'bg-indigo-500/15 text-[#818cf8] font-medium' : 'text-[#6b7280]'}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setWidth('mobile')}
            className={`px-2 py-1 text-xs rounded ${width === 'mobile' ? 'bg-indigo-500/15 text-[#818cf8] font-medium' : 'text-[#6b7280]'}`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="px-2 py-1 text-xs text-[#818cf8] hover:text-[#a5b4fc]"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#111827] p-4 flex justify-center">
        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-400">{error === 'no_content' ? 'No content to preview. Start writing!' : error}</p>
          </div>
        )}
        {loading && (
          <div className="text-center py-8">
            <p className="text-sm text-[#6b7280]">Rendering preview...</p>
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
          <p className="text-sm text-[#6b7280] py-8">Click Refresh to load preview</p>
        )}
      </div>
    </div>
  )
}
