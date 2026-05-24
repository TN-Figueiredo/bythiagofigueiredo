'use client'

import { useState, useCallback, useRef } from 'react'
import type { RendererProps } from '../section-content'
import { generateLessonId } from '@/lib/pipeline/course-schemas'

// ── Types ──────────────────────────────────────────────────────────────────

interface LessonScript {
  title?: string
  talking_points: string[]
  script: string
  production_notes: string
  recording_date: string | null
  actual_duration_seconds: number | null
  equipment_notes: string | null
}

function isLessonScript(v: unknown): v is LessonScript {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const obj = v as Record<string, unknown>
  return (
    Array.isArray(obj.talking_points) &&
    typeof obj.script === 'string'
  )
}

function formatLessonId(id: string): string {
  return id
    .replace(/^l(\d+)$/, 'Aula $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

function parseLessons(content: RendererProps['content']): Record<string, LessonScript> {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return {}
  const obj = content as Record<string, unknown>
  const result: Record<string, LessonScript> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isLessonScript(value)) {
      result[key] = {
        title: typeof value.title === 'string' ? value.title : undefined,
        talking_points: value.talking_points,
        script: value.script,
        production_notes: value.production_notes,
        recording_date: value.recording_date,
        actual_duration_seconds: value.actual_duration_seconds,
        equipment_notes: value.equipment_notes,
      }
    }
  }
  return result
}

function emptyLesson(): LessonScript {
  return {
    talking_points: [],
    script: '',
    production_notes: '',
    recording_date: null,
    actual_duration_seconds: null,
    equipment_notes: null,
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--gem-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 4,
  display: 'block',
}

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--gem-well)',
  border: '1px solid var(--gem-border)',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 12,
  color: 'var(--gem-text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
  lineHeight: 1.5,
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({
  lessonIds,
  selectedId,
  lessons,
  onSelect,
}: {
  lessonIds: string[]
  selectedId: string | null
  lessons: Record<string, LessonScript>
  onSelect: (id: string) => void
}) {
  if (lessonIds.length === 0) {
    return (
      <div
        style={{
          width: 192,
          flexShrink: 0,
          borderRight: '1px solid var(--gem-border)',
          padding: '16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}>
          Nenhuma aula definida no currículo
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 192,
        flexShrink: 0,
        borderRight: '1px solid var(--gem-border)',
        padding: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <p
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--gem-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 8px 12px',
        }}
      >
        Aulas
      </p>
      {lessonIds.map((id) => {
        const lesson = lessons[id]
        const hasScript = (lesson?.script?.trim().length ?? 0) > 0
        const isActive = id === selectedId

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: isActive ? 'color-mix(in srgb, var(--gem-accent) 10%, transparent)' : 'transparent',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              borderLeft: isActive ? '2px solid var(--gem-accent)' : '2px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s',
            }}
          >
            {/* Status dot */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                flexShrink: 0,
                background: hasScript ? 'var(--gem-accent)' : 'transparent',
                border: `1.5px solid ${hasScript ? 'var(--gem-accent)' : 'var(--gem-dim)'}`,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: isActive ? 'var(--gem-accent)' : 'var(--gem-text)',
                fontWeight: isActive ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lesson?.title || formatLessonId(id)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Read mode panel ────────────────────────────────────────────────────────

function ReadPanel({ lesson }: { lesson: LessonScript }) {
  return (
    <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
      {/* Talking points */}
      {lesson.talking_points.length > 0 && (
        <section>
          <span style={LABEL_STYLE}>Pontos principais</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lesson.talking_points.map((point, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--gem-text)' }}>
                <span style={{ color: 'var(--gem-accent)', flexShrink: 0, fontWeight: 700 }}>•</span>
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Script */}
      {lesson.script && (
        <section>
          <span style={LABEL_STYLE}>Roteiro</span>
          <pre
            style={{
              margin: 0,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--gem-text)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '12px 14px',
            }}
          >
            {lesson.script}
          </pre>
        </section>
      )}

      {/* Production metadata */}
      {(lesson.production_notes || lesson.recording_date || lesson.actual_duration_seconds || lesson.equipment_notes) && (
        <section>
          <span style={LABEL_STYLE}>Produção</span>
          <div
            style={{
              background: 'var(--gem-surface)',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '10px 14px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 12,
              rowGap: 6,
              fontSize: 12,
            }}
          >
            {lesson.production_notes && (
              <>
                <span style={{ color: 'var(--gem-dim)', fontWeight: 600 }}>Notas:</span>
                <span style={{ color: 'var(--gem-text)' }}>{lesson.production_notes}</span>
              </>
            )}
            {lesson.recording_date && (
              <>
                <span style={{ color: 'var(--gem-dim)', fontWeight: 600 }}>Gravação:</span>
                <span style={{ color: 'var(--gem-text)' }}>{lesson.recording_date}</span>
              </>
            )}
            {lesson.actual_duration_seconds != null && (
              <>
                <span style={{ color: 'var(--gem-dim)', fontWeight: 600 }}>Duração:</span>
                <span style={{ color: 'var(--gem-text)' }}>{lesson.actual_duration_seconds}s</span>
              </>
            )}
            {lesson.equipment_notes && (
              <>
                <span style={{ color: 'var(--gem-dim)', fontWeight: 600 }}>Equipamento:</span>
                <span style={{ color: 'var(--gem-text)' }}>{lesson.equipment_notes}</span>
              </>
            )}
          </div>
        </section>
      )}

      {/* Empty script */}
      {!lesson.script && lesson.talking_points.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--gem-dim)', fontSize: 12 }}>
          Nenhum conteúdo ainda para esta aula.
        </div>
      )}
    </div>
  )
}

// ── Edit mode panel ────────────────────────────────────────────────────────

function EditPanel({
  lessonId,
  lesson,
  onUpdate,
  onAddLesson,
  onDeleteLesson,
}: {
  lessonId: string
  lesson: LessonScript
  onUpdate: (patch: Partial<LessonScript>) => void
  onAddLesson: () => void
  onDeleteLesson: () => void
}) {
  return (
    <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      {/* Talking points */}
      <section>
        <span style={LABEL_STYLE}>Pontos principais</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lesson.talking_points.map((point, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={point}
                aria-label={`Ponto ${i + 1}`}
                onChange={(e) => {
                  const updated = [...lesson.talking_points]
                  updated[i] = e.target.value
                  onUpdate({ talking_points: updated })
                }}
                style={{ ...INPUT_STYLE, flex: 1 }}
                placeholder={`Ponto ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => {
                  const updated = lesson.talking_points.filter((_, idx) => idx !== i)
                  onUpdate({ talking_points: updated })
                }}
                style={{
                  background: '#f8717122',
                  color: '#f87171',
                  border: '1px solid #f8717155',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                aria-label="Remover ponto"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onUpdate({ talking_points: [...lesson.talking_points, ''] })}
            style={{
              background: 'color-mix(in srgb, var(--gem-accent) 12%, transparent)',
              color: 'var(--gem-accent)',
              border: '1px solid color-mix(in srgb, var(--gem-accent) 30%, transparent)',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            + Adicionar ponto
          </button>
        </div>
      </section>

      {/* Script */}
      <section>
        <span style={LABEL_STYLE}>Roteiro</span>
        <textarea
          value={lesson.script}
          onChange={(e) => onUpdate({ script: e.target.value })}
          style={{ ...TEXTAREA_STYLE, minHeight: 160 }}
          placeholder="Escreva o roteiro da aula..."
          rows={8}
        />
      </section>

      {/* Production notes */}
      <section>
        <span style={LABEL_STYLE}>Notas de produção</span>
        <textarea
          value={lesson.production_notes}
          onChange={(e) => onUpdate({ production_notes: e.target.value })}
          style={{ ...TEXTAREA_STYLE, minHeight: 64 }}
          placeholder="Notas para a equipe de produção..."
          rows={3}
        />
      </section>

      {/* Metadata row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <section>
          <span style={LABEL_STYLE}>Data de gravação</span>
          <input
            type="date"
            value={lesson.recording_date ?? ''}
            onChange={(e) => onUpdate({ recording_date: e.target.value || null })}
            style={INPUT_STYLE}
          />
        </section>
        <section>
          <span style={LABEL_STYLE}>Duração real (segundos)</span>
          <input
            type="number"
            value={lesson.actual_duration_seconds ?? ''}
            onChange={(e) =>
              onUpdate({ actual_duration_seconds: e.target.value ? Number(e.target.value) : null })
            }
            style={INPUT_STYLE}
            placeholder="0"
            min={0}
          />
        </section>
      </div>

      {/* Equipment notes */}
      <section>
        <span style={LABEL_STYLE}>Notas de equipamento</span>
        <input
          type="text"
          value={lesson.equipment_notes ?? ''}
          onChange={(e) => onUpdate({ equipment_notes: e.target.value || null })}
          style={INPUT_STYLE}
          placeholder="Ex: câmera A, microfone lapela..."
        />
      </section>

      {/* Action row */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 12,
          borderTop: '1px solid var(--gem-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onAddLesson}
          style={{
            background: 'color-mix(in srgb, var(--gem-muted) 10%, transparent)',
            color: 'var(--gem-muted)',
            border: '1px solid var(--gem-border)',
            borderRadius: 4,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Adicionar aula
        </button>
        <button
          type="button"
          onClick={onDeleteLesson}
          aria-label="Remover aula"
          style={{
            background: '#f8717122',
            color: '#f87171',
            border: '1px solid #f8717155',
            borderRadius: 4,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Remover aula
        </button>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function LessonsRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const lessons = parseLessons(content)
  const lessonIds = Object.keys(lessons)

  const [selectedId, setSelectedId] = useState<string | null>(() => lessonIds[0] ?? null)

  // Keep selectedId valid when content changes
  const effectiveId =
    selectedId && lessonIds.includes(selectedId)
      ? selectedId
      : lessonIds[0] ?? null

  const lessonsRef = useRef(lessons)
  lessonsRef.current = lessons

  const updateLesson = useCallback(
    (id: string, patch: Partial<LessonScript>) => {
      const current = lessonsRef.current
      const updated = { ...current, [id]: { ...current[id], ...patch } }
      onContentChange(updated as Record<string, unknown>)
    },
    [onContentChange],
  )

  const addLesson = useCallback(() => {
    const current = lessonsRef.current
    const newId = generateLessonId()
    const updated = { ...current, [newId]: emptyLesson() }
    onContentChange(updated as Record<string, unknown>)
    setSelectedId(newId)
  }, [onContentChange])

  const deleteLesson = useCallback(
    (id: string) => {
      if (!window.confirm('Remover esta aula?')) return
      const current = lessonsRef.current
      const { [id]: _, ...rest } = current
      onContentChange(rest as Record<string, unknown>)
      setSelectedId(Object.keys(rest)[0] ?? null)
    },
    [onContentChange],
  )

  return (
    <div
      style={{
        display: 'flex',
        minHeight: 360,
        background: 'var(--gem-surface)',
      }}
    >
      {/* Sidebar */}
      <Sidebar
        lessonIds={lessonIds}
        selectedId={effectiveId}
        lessons={lessons}
        onSelect={setSelectedId}
      />

      {/* Main panel */}
      {lessonIds.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ textAlign: 'center', color: 'var(--gem-dim)', fontSize: 12 }}>
            <p style={{ margin: '0 0 4px' }}>Nenhuma aula definida no currículo.</p>
            {isEditing && (
              <button
                type="button"
                onClick={addLesson}
                style={{
                  marginTop: 8,
                  background: 'color-mix(in srgb, var(--gem-accent) 12%, transparent)',
                  color: 'var(--gem-accent)',
                  border: '1px solid color-mix(in srgb, var(--gem-accent) 30%, transparent)',
                  borderRadius: 4,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Adicionar primeira aula
              </button>
            )}
          </div>
        </div>
      ) : effectiveId && lessons[effectiveId] ? (
        isEditing ? (
          <EditPanel
            lessonId={effectiveId}
            lesson={lessons[effectiveId]}
            onUpdate={(patch) => updateLesson(effectiveId, patch)}
            onAddLesson={addLesson}
            onDeleteLesson={() => deleteLesson(effectiveId)}
          />
        ) : (
          <ReadPanel lesson={lessons[effectiveId]} />
        )
      ) : (
        <div style={{ flex: 1, padding: 20, color: 'var(--gem-dim)', fontSize: 12 }}>
          Selecione uma aula na barra lateral.
        </div>
      )}
    </div>
  )
}
