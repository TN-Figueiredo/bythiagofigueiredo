'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { RendererProps } from '../section-content'
import { migrateV1toV2, type RoteiroContent } from '@/lib/pipeline/roteiro-schemas'
import { ScriptEditMode } from '../editors/script-edit-mode'
import { ScriptViewMode } from './script-view-mode'
import { Eye, Pencil } from 'lucide-react'

type ViewMode = 'edit' | 'view'

export function ScriptRenderer({ content, isEditing, lang, onContentChange }: RendererProps) {
  const [mode, setMode] = useState<ViewMode>('edit')

  const v2Content = useMemo(() => migrateV1toV2(content), [content])

  const handleChange = useCallback(
    (updated: RoteiroContent) => {
      onContentChange(updated as unknown as RendererProps['content'])
    },
    [onContentChange],
  )

  const handleExitView = useCallback(() => setMode('edit'), [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setMode((m) => (m === 'edit' ? 'view' : 'edit'))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  if (mode === 'view') {
    return <ScriptViewMode content={v2Content} onExitView={handleExitView} />
  }

  return (
    <div>
      {/* Mode toggle */}
      <div
        className="flex items-center justify-end gap-1 px-4 py-1.5"
        style={{ borderBottom: '1px solid var(--gem-border)' }}
      >
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            mode === 'edit' ? 'text-[var(--gem-accent)]' : 'text-[var(--gem-dim)] hover:text-[var(--gem-muted)]'
          }`}
          style={mode === 'edit' ? { background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)' } : undefined}
          title="Edit mode"
        >
          <Pencil size={12} className="inline mr-1" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode('view')}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            mode === 'view' ? 'text-[var(--gem-accent)]' : 'text-[var(--gem-dim)] hover:text-[var(--gem-muted)]'
          }`}
          style={mode === 'view' ? { background: 'color-mix(in srgb, var(--gem-accent) 10%, transparent)' } : undefined}
          title="View mode (Cmd+Shift+P)"
        >
          <Eye size={12} className="inline mr-1" />
          View
        </button>
      </div>

      <ScriptEditMode
        content={v2Content}
        isEditing={isEditing}
        onChange={handleChange}
      />
    </div>
  )
}
