'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { PipelineEditor, type JSONContent } from '../../_components/detail/editors/pipeline-editor'
import {
  saveResearchItem,
  updateResearchStatus,
  deleteResearchItem,
} from '../actions'
import type { ResearchStatus } from '@/lib/pipeline/research-schemas'

interface ResearchItemFull {
  id: string
  title: string
  topic_id: string
  content_json: JSONContent | null
  content_md: string | null
  summary: string | null
  sources: Array<{ url: string; title: string; accessed_at?: string }>
  status: string
  word_count: number
  version: number
  created_at: string
  updated_at: string
}

interface ResearchDetailProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any
  isEditing: boolean
  onToggleEdit: (editing: boolean) => void
  onItemUpdated: (item: any) => void
  onItemDeleted: (id: string) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  reviewed: 'Revisado',
  starred: 'Destaque',
  archived: 'Arquivado',
}

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ResearchDetail({
  item,
  isEditing,
  onToggleEdit,
  onItemUpdated,
  onItemDeleted,
}: ResearchDetailProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPendingContent(null)
    setIsDirty(false)
    setSaveState('idle')
  }, [item?.id])

  const handleContentChange = useCallback((content: JSONContent) => {
    setPendingContent(content)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!item || !pendingContent) return
    setSaveState('saving')

    const contentText = extractTextFromJSON(pendingContent)

    const result = await saveResearchItem(item.id, item.version, {
      content_json: pendingContent,
      content_md: contentText,
    })

    if (result.ok) {
      setSaveState('saved')
      setIsDirty(false)
      onItemUpdated(result.data)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('error')
    }
  }, [item, pendingContent, onItemUpdated])

  const handleStatusChange = useCallback(async (status: ResearchStatus) => {
    if (!item) return
    const result = await updateResearchStatus(item.id, status)
    if (result.ok) onItemUpdated(result.data)
  }, [item, onItemUpdated])

  const handleDelete = useCallback(async () => {
    if (!item) return
    if (!confirm('Deletar esta pesquisa permanentemente?')) return
    const result = await deleteResearchItem(item.id)
    if (result.ok) onItemDeleted(item.id)
  }, [item, onItemDeleted])

  if (!item) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gem-muted)',
          fontSize: 13,
        }}
      >
        Selecione um item para ler. Use ↑↓ para navegar.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: STATUS_COLORS[item.status] ?? '#64748b',
              backgroundColor: `${STATUS_COLORS[item.status] ?? '#64748b'}18`,
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
          <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
            {formatDate(item.updated_at)} · {item.word_count.toLocaleString()} palavras · v{item.version}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {item.status !== 'starred' && (
              <button onClick={() => handleStatusChange('starred')} title="Star"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'⭐'}
              </button>
            )}
            {item.status === 'new' && (
              <button onClick={() => handleStatusChange('reviewed')} title="Mark reviewed"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'✓'}
              </button>
            )}
            {item.status !== 'archived' ? (
              <button onClick={() => handleStatusChange('archived')} title="Archive"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'📦'}
              </button>
            ) : (
              <button onClick={() => handleStatusChange('new')} title="Restore"
                style={{ background: 'none', border: '1px solid var(--gem-border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--gem-muted)' }}>
                {'↩'}
              </button>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gem-text)', margin: '4px 0' }}>
          {item.title}
        </h2>

        <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--gem-border)' }}>
          <button
            onClick={() => onToggleEdit(!isEditing)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: isEditing ? '#6366f1' : 'var(--gem-muted)',
              backgroundColor: isEditing ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 5,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Lendo' : 'Editar (E)'}
          </button>
          <button
            onClick={handleDelete}
            style={{
              fontSize: 11,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 5,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            Deletar
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <PipelineEditor
          content={item.content_json ?? item.content_md}
          isEditing={isEditing}
          onContentChange={handleContentChange}
          preset="full"
        />
      </div>

      {/* Sources */}
      {item.sources.length > 0 && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--gem-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase' }}>
            Fontes ({item.sources.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {item.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                {s.title || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Save bar (edit mode) */}
      {isEditing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderTop: '1px solid var(--gem-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: isDirty ? '#fbbf24' : 'var(--gem-muted)' }}>
            {isDirty ? 'Alteracoes nao salvas' : 'Salvo'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--gem-muted)', fontFamily: 'monospace', opacity: 0.6 }}>
              {'⌘'}S
            </span>
            <button
              onClick={handleSave}
              disabled={!isDirty || saveState === 'saving'}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: !isDirty || saveState === 'saving' ? 'default' : 'pointer',
                backgroundColor:
                  saveState === 'saved' ? '#34d399'
                  : saveState === 'error' ? '#ef4444'
                  : saveState === 'saving' ? 'rgba(99,102,241,0.5)'
                  : !isDirty ? 'rgba(99,102,241,0.3)'
                  : 'rgb(99,102,241)',
              }}
            >
              {saveState === 'saved' ? '✓ Salvo'
                : saveState === 'saving' ? 'Salvando...'
                : saveState === 'error' ? 'Erro — tentar novamente'
                : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function extractTextFromJSON(json: JSONContent): string {
  if (!json?.content) return ''
  const parts: string[] = []

  function walk(nodes: JSONContent[]) {
    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        parts.push(node.text)
      }
      if (node.type === 'heading' || node.type === 'paragraph') {
        if (node.content) walk(node.content)
        parts.push('\n')
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        if (node.content) walk(node.content)
      } else if (node.type === 'listItem') {
        parts.push('- ')
        if (node.content) walk(node.content)
      } else if (node.content) {
        walk(node.content)
      }
    }
  }

  walk(json.content)
  return parts.join('').trim()
}
