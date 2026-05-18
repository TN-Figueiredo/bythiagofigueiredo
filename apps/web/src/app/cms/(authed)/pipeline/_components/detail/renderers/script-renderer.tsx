'use client'

import { useMemo, useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { migrateV1toV2, type RoteiroContent } from '@/lib/pipeline/roteiro-schemas'
import { ScriptEditMode } from '../editors/script-edit-mode'

export function ScriptRenderer({ content, isEditing, lang, onContentChange }: RendererProps) {
  const v2Content = useMemo(() => migrateV1toV2(content), [content])

  const handleChange = useCallback(
    (updated: RoteiroContent) => {
      onContentChange(updated as unknown as RendererProps['content'])
    },
    [onContentChange],
  )

  return (
    <ScriptEditMode
      content={v2Content}
      isEditing={isEditing}
      onChange={handleChange}
    />
  )
}
