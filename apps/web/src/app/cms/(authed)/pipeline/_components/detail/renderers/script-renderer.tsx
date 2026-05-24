'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { RendererProps } from '../section-content'
import { migrateV1toV2, type RoteiroContent } from '@/lib/pipeline/roteiro-schemas'
import { ScriptEditMode } from '../editors/script-edit-mode'
import { ScriptViewMode } from './script-view-mode'

function PrintPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

export function ScriptRenderer({ content, isEditing, lang, onContentChange }: RendererProps) {
  const v2Content = useMemo(() => migrateV1toV2(content), [content])

  const handleChange = useCallback(
    (updated: RoteiroContent) => {
      onContentChange(updated as RendererProps['content'])
    },
    [onContentChange],
  )

  return (
    <>
      <ScriptEditMode
        content={v2Content}
        isEditing={isEditing}
        onChange={handleChange}
      />
      <PrintPortal>
        <div className="script-print-view" aria-hidden="true">
          <ScriptViewMode content={v2Content} />
        </div>
      </PrintPortal>
    </>
  )
}
