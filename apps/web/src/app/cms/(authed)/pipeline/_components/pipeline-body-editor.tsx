'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { updatePipelineItem } from '../actions'

interface Props {
  itemId: string
  version: number
  initialContent: string
  format: string
  code: string
}

export function PipelineBodyEditor({ itemId, version: initialVersion, initialContent, format, code }: Props) {
  const [content, setContent] = useState(initialContent)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [currentVersion, setCurrentVersion] = useState(initialVersion)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const save = useCallback(async (text: string) => {
    setSaveState('saving')
    const result = await updatePipelineItem(itemId, currentVersion, { body_content: text })
    if (result.ok && result.data) {
      setCurrentVersion(result.data.version)
      setSaveState('saved')
    } else if (!result.ok) {
      setSaveState('error')
      if (result.error.includes('Version conflict')) {
        toast.error('Item atualizado por outro processo. Recarregando...')
      } else {
        toast.error('Erro ao salvar')
      }
    }
  }, [itemId, currentVersion])

  function handleChange(value: string) {
    setContent(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 2000)
  }

  function handleManualSave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    save(content)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const stateLabel = saveState === 'saved' ? 'Salvo' : saveState === 'saving' ? 'Salvando...' : 'Erro ao salvar'
  const stateColor = saveState === 'saved' ? 'var(--gem-done)' : saveState === 'saving' ? 'var(--gem-warn)' : 'var(--gem-danger)'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--gem-border)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim)' }}>
          <Link href="/cms/up-next" className="hover:underline">Up Next</Link>
          <span>/</span>
          <Link href={`/cms/pipeline/${format}`} className="hover:underline">{format}</Link>
          <span>/</span>
          <span>{code}</span>
          <span>/</span>
          <span style={{ color: 'var(--gem-muted)' }}>Edit</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: stateColor }}>{stateLabel}</span>
          <button onClick={handleManualSave} className="text-xs px-3 py-1 rounded" style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}>Salvar</button>
          <Link href={`/cms/pipeline/items/${itemId}`} className="text-xs px-3 py-1 rounded border" style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-muted)' }}>Cancelar</Link>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Body content editor"
        className="flex-1 w-full p-6 resize-none font-mono text-sm focus:outline-none"
        style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-text)', minHeight: '60vh' }}
        placeholder="Escreva o roteiro / body content aqui..."
      />
      <div className="px-6 py-1.5 flex items-center justify-between text-[10px]" style={{ color: 'var(--gem-dim)', borderTop: '1px solid var(--gem-border)' }}>
        <span>{content.length} chars</span>
        <span aria-live="polite" aria-atomic="true" className="sr-only">{stateLabel}</span>
        <span>⌘S to save</span>
      </div>
    </div>
  )
}
