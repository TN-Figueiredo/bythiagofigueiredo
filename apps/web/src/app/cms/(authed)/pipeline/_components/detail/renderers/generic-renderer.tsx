'use client'

import type { RendererProps } from '../section-content'

export function GenericRenderer({ content, isEditing, onContentChange }: RendererProps) {
  if (content === null) return null

  if (typeof content === 'string') {
    return (
      <div className="p-5">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full min-h-[120px] text-xs p-3 rounded-md resize-y font-sans"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          />
        ) : (
          <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gem-muted)' }}>
            {content || <span style={{ color: 'var(--gem-dim)' }}>Sem conteúdo</span>}
          </div>
        )}
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
            try { onContentChange(JSON.parse(e.target.value) as RendererProps['content']) }
            catch { /* keep current value until valid JSON */ }
          }}
          className="w-full min-h-[200px] text-[11px] p-3 rounded-md resize-y font-mono"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          spellCheck={false}
        />
      ) : (
        <pre
          className="text-[11px] p-3 rounded-md overflow-x-auto"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', whiteSpace: 'pre-wrap' }}
        >
          {formatted}
        </pre>
      )}
    </div>
  )
}
