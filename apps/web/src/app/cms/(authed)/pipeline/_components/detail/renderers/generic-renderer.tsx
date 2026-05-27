'use client'

import { useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, type JSONContent, isJSONContent } from '../editors/pipeline-editor'

export function GenericRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const handleChange = useCallback(
    (json: JSONContent) => onContentChange(json),
    [onContentChange],
  )

  if (content === null) return null

  if (typeof content === 'string' || isJSONContent(content)) {
    return (
      <div className="p-5">
        <PipelineEditor
          content={content}
          isEditing={isEditing}
          onContentChange={handleChange}
          preset="compact"
          placeholder="Escreva aqui..."
        />
      </div>
    )
  }

  const formatted = JSON.stringify(content, null, 2)

  return (
    <div className="p-5">
      {isEditing ? (
        <textarea
          value={formatted}
          onChange={(e) => {
            try {
              onContentChange(JSON.parse(e.target.value) as RendererProps['content'])
            } catch {
              /* keep current value until valid JSON */
            }
          }}
          className="w-full min-h-[200px] text-xs p-3 rounded-md resize-y font-mono"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
          }}
          spellCheck={false}
        />
      ) : (
        <pre
          className="text-xs p-3 rounded-md overflow-x-auto"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-muted)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {formatted}
        </pre>
      )}
    </div>
  )
}
