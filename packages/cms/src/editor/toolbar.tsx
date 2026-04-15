'use client'

import * as React from 'react'

export type ToolbarAction =
  | { kind: 'bold' | 'italic' | 'h1' | 'h2' | 'inline-code' | 'code-block' | 'link' | 'image' }
  | { kind: 'component'; name: string }

export interface EditorToolbarProps {
  onAction: (action: ToolbarAction) => void
  componentNames: string[]
}

export function EditorToolbar({ onAction, componentNames }: EditorToolbarProps) {
  const [openDropdown, setOpenDropdown] = React.useState(false)

  return (
    <div role="toolbar" aria-label="editor toolbar">
      <button type="button" aria-label="bold" onClick={() => onAction({ kind: 'bold' })}>B</button>
      <button type="button" aria-label="italic" onClick={() => onAction({ kind: 'italic' })}>I</button>
      <button type="button" aria-label="heading 1" onClick={() => onAction({ kind: 'h1' })}>H1</button>
      <button type="button" aria-label="heading 2" onClick={() => onAction({ kind: 'h2' })}>H2</button>
      <button type="button" aria-label="inline code" onClick={() => onAction({ kind: 'inline-code' })}>``</button>
      <button type="button" aria-label="code block" onClick={() => onAction({ kind: 'code-block' })}>```</button>
      <button type="button" aria-label="link" onClick={() => onAction({ kind: 'link' })}>Link</button>
      <button type="button" aria-label="image" onClick={() => onAction({ kind: 'image' })}>Img</button>
      <button type="button" aria-label="insert component" onClick={() => setOpenDropdown((v) => !v)}>+Comp</button>
      {openDropdown && componentNames.length > 0 && (
        <div role="menu">
          {componentNames.map((name) => (
            <button
              key={name}
              role="menuitem"
              type="button"
              onClick={() => {
                onAction({ kind: 'component', name })
                setOpenDropdown(false)
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function applyToolbarAction(
  source: string,
  selection: { start: number; end: number },
  action: ToolbarAction,
): { source: string; selectionStart: number } {
  const before = source.slice(0, selection.start)
  const sel = source.slice(selection.start, selection.end)
  const after = source.slice(selection.end)

  switch (action.kind) {
    case 'bold':
      return { source: `${before}**${sel || 'texto'}**${after}`, selectionStart: before.length + 2 }
    case 'italic':
      return { source: `${before}*${sel || 'texto'}*${after}`, selectionStart: before.length + 1 }
    case 'h1':
      return { source: `${before}\n# ${sel || 'Título'}\n${after}`, selectionStart: before.length + 3 }
    case 'h2':
      return { source: `${before}\n## ${sel || 'Subtítulo'}\n${after}`, selectionStart: before.length + 4 }
    case 'inline-code':
      return { source: `${before}\`${sel || 'code'}\`${after}`, selectionStart: before.length + 1 }
    case 'code-block':
      return { source: `${before}\n\`\`\`\n${sel || ''}\n\`\`\`\n${after}`, selectionStart: before.length + 5 }
    case 'link':
      return { source: `${before}[${sel || 'texto'}](url)${after}`, selectionStart: before.length + 1 }
    case 'image':
      return { source: `${before}![${sel || 'alt'}](url)${after}`, selectionStart: before.length + 2 }
    case 'component':
      return { source: `${before}<${action.name}>\n${sel}\n</${action.name}>${after}`, selectionStart: before.length + action.name.length + 2 }
  }
}
