'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PipelineEditor, extractHeadings, isJSONContent, type JSONContent } from '../../_components/detail/editors/pipeline-editor'
import {
  saveResearchItem,
  updateResearchStatus,
  deleteResearchItem,
} from '../actions'
import type { ResearchStatus } from '@/lib/pipeline/research-schemas'
import { RESEARCH_STATUS_COLORS } from '@/lib/pipeline/research-types'
import type { ResearchItemFull } from '@/lib/pipeline/research-types'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface ResearchDetailProps {
  item: ResearchItemFull | null
  loading?: boolean
  isEditing: boolean
  onToggleEdit: (editing: boolean) => void
  onItemUpdated: (item: Partial<ResearchItemFull> & { id: string }) => void
  onItemDeleted: (id: string) => void
  onSelectTopic?: (topicId: string) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STATUS_OPTIONS: Array<{ value: ResearchStatus; label: string }> = [
  { value: 'new', label: 'Novo' },
  { value: 'reviewed', label: 'Revisado' },
  { value: 'starred', label: 'Destaque' },
  { value: 'archived', label: 'Arquivado' },
]

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function SectionOutline({ headings }: { headings: string[] }) {
  if (headings.length < 2) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-md px-3 py-2.5 mb-4"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-widest mr-1"
        style={{ color: 'var(--gem-dim)' }}
      >
        Seções
      </span>
      {headings.map((h, i) => (
        <span key={i} className="contents">
          {i > 0 && <span style={{ color: 'var(--gem-border)' }}>·</span>}
          <span
            className="text-[11px]"
            style={{ color: i === 0 ? 'var(--gem-accent)' : 'var(--gem-muted)' }}
          >
            {h}
          </span>
        </span>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="animate-pulse" style={{ padding: '16px 24px' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-24 rounded" style={{ background: 'var(--gem-well)' }} />
        </div>
        <div className="h-6 w-3/4 rounded mb-2" style={{ background: 'var(--gem-well)' }} />
        <div className="h-3.5 w-full rounded mb-3" style={{ background: 'var(--gem-well)' }} />
        <div className="flex items-center gap-3 pb-3 mb-4" style={{ borderBottom: '1px solid var(--gem-border)' }}>
          <div className="h-5 w-20 rounded" style={{ background: 'var(--gem-well)' }} />
          <div className="h-3 w-16 rounded" style={{ background: 'var(--gem-well)' }} />
          <div className="h-3 w-24 rounded" style={{ background: 'var(--gem-well)' }} />
        </div>
        <div className="flex flex-col gap-3 mt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded"
              style={{ background: 'var(--gem-well)', width: `${90 - i * 5}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ResearchDetail({
  item,
  loading,
  isEditing,
  onToggleEdit,
  onItemUpdated,
  onItemDeleted,
  onSelectTopic,
}: ResearchDetailProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPendingContent(null)
    setIsDirty(false)
    setSaveState('idle')
    setStatusOpen(false)
  }, [item?.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!statusOpen) return
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusOpen])

  const contentJson = item?.content_json
  const contentMd = item?.content_md

  const editorContent = useMemo(() => {
    if (contentJson) return contentJson
    if (typeof contentMd === 'string' && contentMd.trim()) {
      return contentMd
        .replace(/^# (?!#).+\n*/m, '')
        .replace(/^# (?!#)/gm, '## ')
    }
    return null
  }, [contentJson, contentMd])

  const headings = useMemo(() => {
    const json = contentJson as JSONContent | null
    if (isJSONContent(json)) return extractHeadings(json)
    if (typeof contentMd === 'string') {
      return Array.from(contentMd.matchAll(/^#{2,4}\s+(.+)$/gm))
        .map((m) => m[1]!.trim())
        .filter(Boolean)
    }
    return []
  }, [contentJson, contentMd])

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
      if (result.data) onItemUpdated(result.data as Partial<ResearchItemFull> & { id: string })
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('error')
    }
  }, [item, pendingContent, onItemUpdated])

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    if (!isEditing) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isEditing])

  const handleStatusChange = useCallback(async (status: ResearchStatus) => {
    if (!item) return
    setStatusOpen(false)
    const result = await updateResearchStatus(item.id, status, item.version)
    if (result.ok && result.data) onItemUpdated(result.data as Partial<ResearchItemFull> & { id: string })
  }, [item, onItemUpdated])

  const handleDelete = useCallback(async () => {
    if (!item) return
    if (!confirm('Deletar esta pesquisa permanentemente?')) return
    const result = await deleteResearchItem(item.id)
    if (result.ok) onItemDeleted(item.id)
  }, [item, onItemDeleted])

  if (!item) {
    if (loading) return <DetailSkeleton />
    return (
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ flex: 1, color: 'var(--gem-dim)' }}
      >
        <span style={{ fontSize: 28, opacity: 0.3 }}>{'📖'}</span>
        <span className="text-xs">Selecione um item para ler.</span>
      </div>
    )
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === item.status)
  const statusColor = RESEARCH_STATUS_COLORS[item.status] ?? '#64748b'
  const hasContent = editorContent && (typeof editorContent !== 'string' || editorContent.trim())

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        {/* Row 1: Topic breadcrumb + Actions */}
        <div className="flex items-center justify-between mb-2.5">
          <button
            type="button"
            onClick={() => item.topic_id && onSelectTopic?.(item.topic_id)}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: onSelectTopic ? 'pointer' : 'default',
              color: 'var(--gem-dim)',
            }}
          >
            {item.topic_icon && <span className="text-[13px]">{item.topic_icon}</span>}
            <span
              className="text-[11px] hover:underline"
              style={{ textDecorationColor: 'var(--gem-dim)', textUnderlineOffset: 2 }}
            >
              {item.topic_path ?? item.topic_name ?? ''}
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleEdit(!isEditing)}
              className="text-[11px] font-medium rounded-[5px] px-2.5 py-[3px] cursor-pointer transition-all duration-150"
              style={{
                color: isEditing ? '#818cf8' : 'var(--gem-muted)',
                backgroundColor: isEditing ? 'rgba(99,102,241,0.1)' : 'transparent',
                border: `1px solid ${isEditing ? 'rgba(99,102,241,0.3)' : 'var(--gem-border)'}`,
              }}
              onMouseEnter={(e) => {
                if (!isEditing) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={(e) => {
                if (!isEditing) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {isEditing ? 'Lendo' : 'Editar (E)'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-[11px] rounded-[5px] px-2.5 py-[3px] cursor-pointer transition-all duration-150"
              style={{
                color: '#ef4444',
                backgroundColor: 'transparent',
                border: '1px solid var(--gem-border)',
                opacity: 0.6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.opacity = '0.6'
              }}
            >
              Deletar
            </button>
          </div>
        </div>

        {/* Row 2: Title + summary */}
        <h2
          className="text-xl font-bold leading-tight"
          style={{ color: 'var(--gem-text)', margin: '0 0 4px' }}
        >
          {item.title}
        </h2>
        {item.summary && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--gem-dim)', margin: '0 0 8px' }}>
            {item.summary}
          </p>
        )}

        {/* Row 3: Status + meta */}
        <div
          className="flex items-center gap-2.5 pb-3"
          style={{ borderBottom: '1px solid var(--gem-border)' }}
        >
          {/* Status dropdown */}
          <div ref={statusRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setStatusOpen(!statusOpen)}
              className="flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[0.05em] rounded px-2.5 py-[3px] cursor-pointer transition-opacity hover:opacity-80"
              style={{
                color: statusColor,
                backgroundColor: `${statusColor}18`,
                border: `1px solid ${statusColor}30`,
              }}
              aria-haspopup="listbox"
              aria-expanded={statusOpen}
            >
              {currentStatus?.label ?? item.status}
              <span className="text-[8px] opacity-60">{'▼'}</span>
            </button>
            {statusOpen && (
              <div
                className="absolute top-full left-0 mt-1 min-w-[140px] rounded-md p-1 z-20"
                style={{
                  backgroundColor: 'var(--gem-surface)',
                  border: '1px solid var(--gem-border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                role="listbox"
                aria-label="Status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 border-none rounded cursor-pointer text-[11px] transition-colors"
                    style={{
                      backgroundColor: item.status === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                      color: item.status === opt.value ? 'var(--gem-text)' : 'var(--gem-muted)',
                    }}
                    role="option"
                    aria-selected={item.status === opt.value}
                    onMouseEnter={(e) => {
                      if (item.status !== opt.value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (item.status !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ backgroundColor: RESEARCH_STATUS_COLORS[opt.value] }}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[11px]" style={{ color: 'var(--gem-dim)' }}>
            {formatDate(item.updated_at)}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--gem-dim)' }}>
            {item.word_count.toLocaleString()} palavras
          </span>
          <span className="text-[11px] font-mono" style={{ color: 'var(--gem-dim)' }}>
            v{item.version}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="p-5">
          {!isEditing && <SectionOutline headings={headings} />}
          {hasContent ? (
            <PipelineEditor
              key={item.id}
              content={editorContent}
              isEditing={isEditing}
              onContentChange={handleContentChange}
              preset="full"
              placeholder="Escreva o conteúdo da sua pesquisa..."
            />
          ) : (
            <div
              className="py-8 text-center text-[11px]"
              style={{ color: 'var(--gem-dim)' }}
            >
              Nenhum conteúdo importado.
            </div>
          )}
        </div>

        {/* Linked Pipeline Items */}
        {!isEditing && item.linked_items && item.linked_items.length > 0 && (
          <div style={{ padding: '0 24px 16px', borderTop: '1px solid var(--gem-border)' }}>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.05em] py-3 pb-2"
              style={{ color: 'var(--gem-dim)' }}
            >
              Pipeline ({item.linked_items.length})
            </div>
            <div className="flex flex-col gap-1">
              {item.linked_items.map((link) => {
                const fmt = getFormatIcon(link.format ?? '')
                return (
                  <Link
                    key={link.link_id}
                    href={`/cms/pipeline/${link.format}#${link.pipeline_item_id}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md no-underline text-xs transition-all duration-150"
                    style={{ border: '1px solid var(--gem-border)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--gem-well)'
                      e.currentTarget.style.borderColor = 'var(--gem-accent)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.borderColor = 'var(--gem-border)'
                    }}
                  >
                    <span className="text-sm">{fmt.icon}</span>
                    <span
                      className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ color: 'var(--gem-text)' }}
                    >
                      {link.title}
                    </span>
                    {link.stage && (
                      <span
                        className="text-[9px] font-semibold uppercase rounded px-1.5 py-px"
                        style={{ color: 'var(--gem-dim)', backgroundColor: 'var(--gem-well)' }}
                      >
                        {link.stage}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Sources */}
        {!isEditing && item.sources.length > 0 && (
          <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--gem-border)' }}>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.05em] py-3 pb-2"
              style={{ color: 'var(--gem-dim)' }}
            >
              Fontes ({item.sources.length})
            </div>
            <div className="flex flex-col gap-1">
              {item.sources.map((s: { url: string; title?: string }, i: number) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-[5px] rounded-md no-underline text-xs overflow-hidden transition-all duration-150"
                  style={{
                    border: '1px solid var(--gem-border)',
                    color: 'var(--gem-accent)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gem-well)'
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--gem-border)'
                  }}
                >
                  <span className="text-[11px] opacity-50">{'↗'}</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {s.title || safeHostname(s.url)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save bar (edit mode) */}
      {isEditing && (
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '10px 24px', borderTop: '1px solid var(--gem-border)' }}
        >
          <span className="text-[11px]" style={{ color: isDirty ? '#fbbf24' : 'var(--gem-dim)' }}>
            {isDirty ? 'Alterações não salvas' : 'Salvo'}
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-mono opacity-60"
              style={{ color: 'var(--gem-dim)' }}
            >
              {'⌘'}S
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saveState === 'saving'}
              className="px-4 py-1.5 text-xs font-semibold text-white border-none rounded-md transition-all duration-150"
              style={{
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
      } else if (node.type === 'hardBreak') {
        parts.push('\n')
      }

      switch (node.type) {
        case 'heading': {
          const level = (node.attrs?.level as number) ?? 1
          parts.push('#'.repeat(level) + ' ')
          if (node.content) walk(node.content)
          parts.push('\n\n')
          break
        }
        case 'paragraph':
          if (node.content) walk(node.content)
          parts.push('\n')
          break
        case 'blockquote':
          parts.push('> ')
          if (node.content) walk(node.content)
          break
        case 'codeBlock':
          parts.push('```\n')
          if (node.content) walk(node.content)
          parts.push('\n```\n')
          break
        case 'bulletList':
        case 'orderedList':
          if (node.content) walk(node.content)
          break
        case 'listItem':
          parts.push('- ')
          if (node.content) walk(node.content)
          break
        case 'horizontalRule':
          parts.push('\n---\n')
          break
        default:
          if (node.content) walk(node.content)
          break
      }
    }
  }

  walk(json.content)
  return parts.join('').trim()
}
