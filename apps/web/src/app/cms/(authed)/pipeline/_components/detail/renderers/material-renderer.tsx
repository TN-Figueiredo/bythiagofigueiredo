'use client'

import { useState, useCallback, useRef } from 'react'
import type { RendererProps } from '../section-content'
import { LessonResourceSchema } from '@/lib/pipeline/course-schemas'
import { z } from 'zod'

// ── Types ──────────────────────────────────────────────────────────────────

type ResourceType = 'pdf' | 'repo' | 'link' | 'template' | 'tool'

interface MaterialItem {
  label: string
  type: ResourceType
  url: string | null
  media_id?: string | null
}

const MaterialContentSchema = z.record(z.string(), z.array(LessonResourceSchema))

function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url
    return undefined
  } catch { return undefined }
}

function parseMaterial(content: RendererProps['content']): Record<string, MaterialItem[]> {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return {}
  const parsed = MaterialContentSchema.safeParse(content)
  if (parsed.success) return parsed.data as Record<string, MaterialItem[]>
  // Fallback: best-effort parse
  const obj = content as Record<string, unknown>
  const result: Record<string, MaterialItem[]> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!Array.isArray(value)) continue
    result[key] = value.filter(
      (v): v is MaterialItem =>
        v !== null &&
        typeof v === 'object' &&
        typeof (v as Record<string, unknown>).label === 'string' &&
        typeof (v as Record<string, unknown>).type === 'string',
    )
  }
  return result
}

// ── Constants ──────────────────────────────────────────────────────────────

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  pdf: 'PDF',
  repo: 'Repositório',
  link: 'Link',
  template: 'Template',
  tool: 'Ferramenta',
}

const RESOURCE_TYPE_COLORS: Record<ResourceType, string> = {
  pdf: '#ef4444',
  repo: '#8b5cf6',
  link: '#3b82f6',
  template: '#f59e0b',
  tool: '#10b981',
}

const RESOURCE_TYPES: ResourceType[] = ['pdf', 'repo', 'link', 'template', 'tool']

// ── Shared style helpers ───────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--gem-well)',
  border: '1px solid var(--gem-border)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
  color: 'var(--gem-text)',
  outline: 'none',
}

function TypeBadge({ type }: { type: ResourceType }) {
  const color = RESOURCE_TYPE_COLORS[type] ?? 'var(--gem-dim)'
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {RESOURCE_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ── Read mode ─────────────────────────────────────────────────────────────

function ReadMode({ data }: { data: Record<string, MaterialItem[]> }) {
  const lessonIds = Object.keys(data)

  if (lessonIds.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--gem-dim)', fontSize: 12 }}>
        Nenhum material cadastrado ainda.
      </div>
    )
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {lessonIds.map((lessonId) => {
        const resources = data[lessonId] ?? []
        return (
          <div
            key={lessonId}
            style={{
              background: 'var(--gem-surface)',
              border: '1px solid var(--gem-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {/* Lesson header */}
            <div
              style={{
                padding: '8px 14px',
                borderBottom: resources.length > 0 ? '1px solid var(--gem-border)' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gem-muted)', fontFamily: 'monospace' }}>
                {lessonId}
              </span>
              <span style={{ fontSize: 11, color: 'var(--gem-dim)' }}>
                {resources.length} {resources.length === 1 ? 'material' : 'materiais'}
              </span>
            </div>

            {/* Resources */}
            {resources.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--gem-dim)' }}>
                Nenhum material para esta aula.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {resources.map((res, idx) => (
                  <div
                    key={`${res.label}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 14px',
                      borderBottom:
                        idx < resources.length - 1 ? '1px solid var(--gem-border)' : undefined,
                    }}
                  >
                    <TypeBadge type={res.type} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--gem-text)' }}>
                      {res.label}
                    </span>
                    {safeHref(res.url) ? (
                      <a
                        href={safeHref(res.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          color: 'var(--gem-accent)',
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        Abrir ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--gem-dim)', flexShrink: 0 }}>
                        Sem URL
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Edit mode — resource row ───────────────────────────────────────────────

function ResourceRow({
  resource,
  onUpdate,
  onRemove,
}: {
  resource: MaterialItem
  onUpdate: (patch: Partial<MaterialItem>) => void
  onRemove: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'flex-end',
        background: 'var(--gem-well)',
        border: '1px solid var(--gem-border)',
        borderRadius: 6,
        padding: '8px 10px',
        flexWrap: 'wrap',
      }}
    >
      {/* Label */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 2, minWidth: 120 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Rótulo
        </span>
        <input
          type="text"
          value={resource.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          style={INPUT_STYLE}
          placeholder="Nome do material"
          aria-label="Rótulo do material"
        />
      </label>

      {/* Type */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tipo
        </span>
        <select
          value={resource.type}
          onChange={(e) => onUpdate({ type: e.target.value as ResourceType })}
          style={{ ...INPUT_STYLE, cursor: 'pointer' }}
          aria-label="Tipo do material"
        >
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {/* URL */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 3, minWidth: 150 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          URL
        </span>
        <input
          type="url"
          value={resource.url ?? ''}
          onChange={(e) => onUpdate({ url: e.target.value || null })}
          style={INPUT_STYLE}
          placeholder="https://..."
          aria-label="URL do material"
        />
      </label>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover material"
        style={{
          background: '#f8717122',
          color: '#f87171',
          border: '1px solid #f8717155',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          alignSelf: 'flex-end',
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── Edit mode — lesson block ───────────────────────────────────────────────

function LessonMaterialBlock({
  lessonId,
  resources,
  onUpdateResource,
  onRemoveResource,
  onAddResource,
  onRemoveLesson,
}: {
  lessonId: string
  resources: MaterialItem[]
  onUpdateResource: (idx: number, patch: Partial<MaterialItem>) => void
  onRemoveResource: (idx: number) => void
  onAddResource: () => void
  onRemoveLesson: () => void
}) {
  return (
    <div
      style={{
        background: 'var(--gem-surface)',
        border: '1px solid var(--gem-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--gem-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--gem-muted)', fontFamily: 'monospace' }}>
          {lessonId}
        </span>
        <button
          type="button"
          onClick={onRemoveLesson}
          style={{
            background: '#f8717112',
            color: '#f87171',
            border: '1px solid #f8717133',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Remover aula
        </button>
      </div>

      {/* Resources */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {resources.map((res, idx) => (
          <ResourceRow
            key={`${lessonId}-${idx}`}
            resource={res}
            onUpdate={(patch) => onUpdateResource(idx, patch)}
            onRemove={() => onRemoveResource(idx)}
          />
        ))}
        <button
          type="button"
          onClick={onAddResource}
          style={{
            background: 'color-mix(in srgb, var(--gem-accent) 12%, transparent)',
            color: 'var(--gem-accent)',
            border: '1px solid color-mix(in srgb, var(--gem-accent) 30%, transparent)',
            borderRadius: 4,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          + Adicionar material
        </button>
      </div>
    </div>
  )
}

// ── Edit mode ─────────────────────────────────────────────────────────────

function EditMode({
  data,
  onContentChange,
}: {
  data: Record<string, MaterialItem[]>
  onContentChange: (updated: Record<string, unknown>) => void
}) {
  const [newLessonId, setNewLessonId] = useState('')
  const dataRef = useRef(data)
  dataRef.current = data

  function emit(updated: Record<string, MaterialItem[]>) {
    onContentChange(updated as Record<string, unknown>)
  }

  function updateResource(lessonId: string, idx: number, patch: Partial<MaterialItem>) {
    const current = dataRef.current
    const resources = [...(current[lessonId] ?? [])]
    const existing: MaterialItem = resources[idx] ?? { label: '', type: 'link', url: null }
    resources[idx] = { ...existing, ...patch }
    emit({ ...current, [lessonId]: resources })
  }

  function removeResource(lessonId: string, idx: number) {
    const current = dataRef.current
    const resources = (current[lessonId] ?? []).filter((_, i) => i !== idx)
    emit({ ...current, [lessonId]: resources })
  }

  function addResource(lessonId: string) {
    const current = dataRef.current
    const resources = [...(current[lessonId] ?? []), { label: '', type: 'link' as ResourceType, url: null }]
    emit({ ...current, [lessonId]: resources })
  }

  function removeLesson(lessonId: string) {
    if (!window.confirm('Remover este grupo de materiais?')) return
    const current = { ...dataRef.current }
    delete current[lessonId]
    emit(current)
  }

  function addLesson() {
    const id = newLessonId.trim()
    if (!id) return
    const current = dataRef.current
    if (current[id]) return
    emit({ ...current, [id]: [] })
    setNewLessonId('')
  }

  const lessonIds = Object.keys(data)

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add lesson */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'var(--gem-well)',
          border: '1px solid var(--gem-border)',
          borderRadius: 8,
          padding: '10px 14px',
        }}
      >
        <input
          type="text"
          value={newLessonId}
          onChange={(e) => setNewLessonId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addLesson() }}
          placeholder="ID da aula (ex: l1, abc123)"
          style={{ ...INPUT_STYLE, flex: 1 }}
          aria-label="ID da aula para adicionar"
        />
        <button
          type="button"
          onClick={addLesson}
          disabled={!newLessonId.trim()}
          style={{
            background: 'color-mix(in srgb, var(--gem-accent) 15%, transparent)',
            color: 'var(--gem-accent)',
            border: '1px solid color-mix(in srgb, var(--gem-accent) 35%, transparent)',
            borderRadius: 4,
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 600,
            cursor: newLessonId.trim() ? 'pointer' : 'not-allowed',
            opacity: newLessonId.trim() ? 1 : 0.5,
          }}
        >
          + Adicionar aula
        </button>
      </div>

      {/* Empty state */}
      {lessonIds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gem-dim)', fontSize: 12 }}>
          Nenhuma aula com material ainda. Insira o ID de uma aula acima para começar.
        </div>
      )}

      {/* Lesson blocks */}
      {lessonIds.map((lessonId) => (
        <LessonMaterialBlock
          key={lessonId}
          lessonId={lessonId}
          resources={data[lessonId] ?? []}
          onUpdateResource={(idx, patch) => updateResource(lessonId, idx, patch)}
          onRemoveResource={(idx) => removeResource(lessonId, idx)}
          onAddResource={() => addResource(lessonId)}
          onRemoveLesson={() => removeLesson(lessonId)}
        />
      ))}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function MaterialRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseMaterial(content)

  const handleChange = useCallback(
    (updated: Record<string, unknown>) => {
      onContentChange(updated)
    },
    [onContentChange],
  )

  return isEditing ? (
    <EditMode data={data} onContentChange={handleChange} />
  ) : (
    <ReadMode data={data} />
  )
}
