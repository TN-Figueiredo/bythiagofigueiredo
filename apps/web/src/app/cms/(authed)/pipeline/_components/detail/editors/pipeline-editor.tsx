'use client'

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { useMemo, useEffect } from 'react'
import { parse } from 'marked'
import { getExtensions } from './pipeline-extensions'
import { PipelineToolbar } from './pipeline-toolbar'
import { transformPastedHTML } from './paste-sanitizer'
import './pipeline-editor.css'

export type { JSONContent }

export interface PipelineEditorProps {
  content: string | JSONContent | Record<string, unknown> | unknown[] | null
  isEditing: boolean
  onContentChange: (content: JSONContent) => void
  preset: 'full' | 'compact' | 'blog'
  placeholder?: string
}

export function isJSONContent(value: unknown): value is JSONContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'doc'
  )
}

export function contentToEditorInput(
  content: PipelineEditorProps['content'],
): JSONContent | string {
  if (!content) return ''
  if (typeof content === 'string') {
    if (!content.trim()) return ''
    return parse(content, { async: false }) as string
  }
  if (isJSONContent(content)) return content
  return ''
}

export function extractHeadings(content: JSONContent | null): string[] {
  if (!content?.content) return []
  return content.content
    .filter((node) => node.type === 'heading')
    .map((node) => node.content?.map((c) => c.text ?? '').join('') ?? '')
    .filter(Boolean)
}

export function PipelineEditor({
  content,
  isEditing,
  onContentChange,
  preset,
  placeholder,
}: PipelineEditorProps) {
  const extensions = useMemo(
    () => getExtensions(preset, { placeholder }),
    [preset, placeholder],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => contentToEditorInput(content), [])

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: isEditing,
    immediatelyRender: false,
    editorProps: {
      transformPastedHTML,
      attributes: {
        class: preset === 'compact' ? 'compact' : '',
      },
    },
    onUpdate: ({ editor: e }) => {
      onContentChange(e.getJSON())
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const readingMin = Math.max(1, Math.round(wordCount / 200))

  if (!editor) return null

  return (
    <div className="pipeline-editor" data-readonly={!isEditing}>
      {isEditing && <PipelineToolbar editor={editor} preset={preset} />}
      <EditorContent editor={editor} />
      <div className="pipeline-editor-stats">
        <span>{wordCount} palavras · ~{readingMin} min leitura</span>
      </div>
    </div>
  )
}
