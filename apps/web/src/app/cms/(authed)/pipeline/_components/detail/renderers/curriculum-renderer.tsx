'use client'

import { useState, useCallback } from 'react'
import type { RendererProps } from '../section-content'
import {
  CurriculumContentSchema,
  computeModuleProgress,
  computeCourseProgress,
  generateModuleId,
  generateLessonId,
  type CurriculumContent,
  type CurriculumModule,
} from '@/lib/pipeline/course-schemas'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  outline: 'var(--gem-dim)',
  scripted: 'var(--gem-accent)',
  recorded: 'var(--gem-warn)',
  edited: '#06b6d4',
  ready: 'var(--gem-done)',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  video: 'Vídeo',
  text: 'Texto',
  quiz: 'Quiz',
  exercise: 'Exercício',
  pdf: 'PDF',
  live: 'Live',
  mixed: 'Misto',
}

const STATUS_LABELS: Record<string, string> = {
  outline: 'Rascunho',
  scripted: 'Roteirizado',
  recorded: 'Gravado',
  edited: 'Editado',
  ready: 'Pronto',
}

function Badge({
  label,
  color,
  size = 'sm',
}: {
  label: string
  color: string
  size?: 'xs' | 'sm'
}) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: size === 'xs' ? '1px 5px' : '2px 7px',
        fontSize: size === 'xs' ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </span>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: 'var(--gem-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100 ? 'var(--gem-done)' : 'var(--gem-accent)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: 'var(--gem-muted)', minWidth: 32 }}>
        {done}/{total}
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Read mode
// ──────────────────────────────────────────────────────────────

function ReadMode({ data }: { data: CurriculumContent }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(data.modules.map((m) => m.id)),
  )

  const courseProgress = computeCourseProgress(data)

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Course meta */}
      <div
        style={{
          background: 'var(--gem-well)',
          border: '1px solid var(--gem-border)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap' as const,
          gap: 10,
          alignItems: 'center',
        }}
      >
        {data.target_audience && (
          <span style={{ fontSize: 12, color: 'var(--gem-muted)' }}>
            Público:{' '}
            <strong style={{ color: 'var(--gem-text)' }}>{data.target_audience}</strong>
          </span>
        )}
        <Badge
          label={DIFFICULTY_LABELS[data.difficulty] ?? data.difficulty}
          color="var(--gem-accent)"
        />
        <Badge
          label={data.curriculum_mode === 'fixed' ? 'Sequencial' : 'Progressivo'}
          color="var(--gem-muted)"
        />
        {data.estimated_hours > 0 && (
          <span style={{ fontSize: 12, color: 'var(--gem-muted)' }}>
            {data.estimated_hours}h estimadas
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--gem-dim)' }}>Progresso total:</span>
          <span style={{ fontSize: 11, color: 'var(--gem-text)', fontWeight: 600 }}>
            {courseProgress.done}/{courseProgress.total}
          </span>
        </div>
      </div>

      {/* Total progress bar */}
      <ProgressBar done={courseProgress.done} total={courseProgress.total} />

      {/* Learning outcomes */}
      {data.learning_outcomes.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--gem-muted)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}
          >
            O que você vai aprender
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.learning_outcomes.map((outcome, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--gem-text)', display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--gem-done)', flexShrink: 0 }}>✓</span>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.modules.map((mod) => {
          const prog = computeModuleProgress(mod)
          const isExpanded = expandedModules.has(mod.id)
          return (
            <div
              key={mod.id}
              style={{
                background: 'var(--gem-surface)',
                border: '1px solid var(--gem-border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Module header */}
              <button
                type="button"
                onClick={() => toggleModule(mod.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--gem-dim)',
                    transition: 'transform 0.2s',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                  }}
                >
                  ▶
                </span>
                <span
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--gem-text)' }}
                >
                  {mod.title}
                </span>
                <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
                  {prog.done}/{prog.total} aulas
                </span>
              </button>

              {/* Module progress bar */}
              <div style={{ padding: '0 14px 8px' }}>
                <ProgressBar done={prog.done} total={prog.total} />
              </div>

              {/* Lessons */}
              {isExpanded && mod.lessons.length > 0 && (
                <div style={{ borderTop: '1px solid var(--gem-border)' }}>
                  {mod.lessons.map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px',
                        borderBottom:
                          idx < mod.lessons.length - 1
                            ? '1px solid var(--gem-border)'
                            : undefined,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--gem-dim)', minWidth: 20 }}>
                        {lesson.sort_order + 1}.
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--gem-text)' }}>
                        {lesson.title}
                      </span>
                      <Badge
                        label={LESSON_TYPE_LABELS[lesson.type] ?? lesson.type}
                        color="var(--gem-muted)"
                        size="xs"
                      />
                      <Badge
                        label={STATUS_LABELS[lesson.production_status] ?? lesson.production_status}
                        color={STATUS_COLORS[lesson.production_status] ?? 'var(--gem-dim)'}
                        size="xs"
                      />
                      <span style={{ fontSize: 10, color: 'var(--gem-dim)', minWidth: 30 }}>
                        {lesson.estimated_minutes}min
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Edit mode — helpers
// ──────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--gem-well)',
  border: '1px solid var(--gem-border)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
  color: 'var(--gem-text)',
  outline: 'none',
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  style,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  style?: React.CSSProperties
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--gem-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...INPUT_STYLE, ...style }}
      />
    </label>
  )
}

function EditSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--gem-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...INPUT_STYLE, cursor: 'pointer' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SmallButton({
  label,
  onClick,
  color = 'var(--gem-accent)',
}: {
  label: string
  onClick: () => void
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
// Edit mode — lesson row
// ──────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  moduleId,
  onUpdate,
  onRemove,
}: {
  lesson: CurriculumContent['modules'][number]['lessons'][number]
  moduleId: string
  onUpdate: (moduleId: string, lessonId: string, patch: Partial<typeof lesson>) => void
  onRemove: (moduleId: string, lessonId: string) => void
}) {
  return (
    <div
      style={{
        background: 'var(--gem-well)',
        border: '1px solid var(--gem-border)',
        borderRadius: 6,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
        <div style={{ flex: 2, minWidth: 120 }}>
          <EditField
            label="Título"
            value={lesson.title}
            onChange={(v) => onUpdate(moduleId, lesson.id, { title: v })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <EditSelect
            label="Tipo"
            value={lesson.type}
            options={Object.entries(LESSON_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) =>
              onUpdate(moduleId, lesson.id, {
                type: v as CurriculumContent['modules'][number]['lessons'][number]['type'],
              })
            }
          />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <EditSelect
            label="Status"
            value={lesson.production_status}
            options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) =>
              onUpdate(moduleId, lesson.id, {
                production_status: v as CurriculumContent['modules'][number]['lessons'][number]['production_status'],
              })
            }
          />
        </div>
        <div style={{ width: 64 }}>
          <EditField
            label="Min"
            value={lesson.estimated_minutes}
            type="number"
            onChange={(v) => onUpdate(moduleId, lesson.id, { estimated_minutes: Number(v) || 10 })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gem-muted)', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={lesson.is_preview}
            onChange={(e) => onUpdate(moduleId, lesson.id, { is_preview: e.target.checked })}
          />
          Preview gratuito
        </label>
        <div style={{ marginLeft: 'auto' }}>
          <SmallButton
            label="Remover"
            color="#f87171"
            onClick={() => onRemove(moduleId, lesson.id)}
          />
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Edit mode — module section
// ──────────────────────────────────────────────────────────────

function ModuleEditSection({
  mod,
  onUpdateModule,
  onRemoveModule,
  onUpdateLesson,
  onRemoveLesson,
  onAddLesson,
  onLessonDragEnd,
}: {
  mod: CurriculumModule
  onUpdateModule: (moduleId: string, patch: Partial<CurriculumModule>) => void
  onRemoveModule: (moduleId: string) => void
  onUpdateLesson: (moduleId: string, lessonId: string, patch: Partial<CurriculumModule['lessons'][number]>) => void
  onRemoveLesson: (moduleId: string, lessonId: string) => void
  onAddLesson: (moduleId: string) => void
  onLessonDragEnd: (moduleId: string, event: DragEndEvent) => void
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
      {/* Module header fields */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--gem-border)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap' as const,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 2, minWidth: 120 }}>
          <EditField
            label="Módulo"
            value={mod.title}
            onChange={(v) => onUpdateModule(mod.id, { title: v })}
          />
        </div>
        <div style={{ flex: 3, minWidth: 160 }}>
          <EditField
            label="Descrição"
            value={mod.description}
            onChange={(v) => onUpdateModule(mod.id, { description: v })}
          />
        </div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gem-muted)', cursor: 'pointer', paddingBottom: 4 }}
        >
          <input
            type="checkbox"
            checked={mod.is_preview}
            onChange={(e) => onUpdateModule(mod.id, { is_preview: e.target.checked })}
          />
          Preview
        </label>
        <SmallButton
          label="Remover módulo"
          color="#f87171"
          onClick={() => onRemoveModule(mod.id)}
        />
      </div>

      {/* Lessons */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event) => onLessonDragEnd(mod.id, event)}
        >
          <SortableContext
            items={mod.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {mod.lessons.map((lesson) => (
              <SortableItem key={lesson.id} id={lesson.id}>
                <LessonRow
                  lesson={lesson}
                  moduleId={mod.id}
                  onUpdate={onUpdateLesson}
                  onRemove={onRemoveLesson}
                />
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>

        <SmallButton
          label="+ Adicionar aula"
          onClick={() => onAddLesson(mod.id)}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Edit mode — full editor
// ──────────────────────────────────────────────────────────────

function EditMode({
  data,
  onContentChange,
}: {
  data: CurriculumContent
  onContentChange: (content: Record<string, unknown>) => void
}) {
  function emit(updated: CurriculumContent) {
    onContentChange(updated as unknown as Record<string, unknown>)
  }

  function updateTopLevel(patch: Partial<CurriculumContent>) {
    emit({ ...data, ...patch })
  }

  function updateModule(moduleId: string, patch: Partial<CurriculumModule>) {
    emit({
      ...data,
      modules: data.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)),
    })
  }

  function removeModule(moduleId: string) {
    emit({ ...data, modules: data.modules.filter((m) => m.id !== moduleId) })
  }

  function addModule() {
    const id = generateModuleId()
    emit({
      ...data,
      modules: [
        ...data.modules,
        {
          id,
          title: 'Novo módulo',
          description: '',
          sort_order: data.modules.length,
          is_preview: false,
          lessons: [],
        },
      ],
    })
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = data.modules.findIndex((m) => m.id === active.id)
    const newIndex = data.modules.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(data.modules, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sort_order: i,
    }))
    emit({ ...data, modules: reordered })
  }

  function updateLesson(
    moduleId: string,
    lessonId: string,
    patch: Partial<CurriculumModule['lessons'][number]>,
  ) {
    emit({
      ...data,
      modules: data.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
            }
          : m,
      ),
    })
  }

  function removeLesson(moduleId: string, lessonId: string) {
    emit({
      ...data,
      modules: data.modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
          : m,
      ),
    })
  }

  function addLesson(moduleId: string) {
    const id = generateLessonId()
    emit({
      ...data,
      modules: data.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: [
                ...m.lessons,
                {
                  id,
                  title: 'Nova aula',
                  type: 'video' as const,
                  sort_order: m.lessons.length,
                  is_preview: false,
                  estimated_minutes: 10,
                  production_status: 'outline' as const,
                  pipeline_ref: null,
                  resources: [],
                },
              ],
            }
          : m,
      ),
    })
  }

  function handleLessonDragEnd(moduleId: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    emit({
      ...data,
      modules: data.modules.map((m) => {
        if (m.id !== moduleId) return m
        const oldIndex = m.lessons.findIndex((l) => l.id === active.id)
        const newIndex = m.lessons.findIndex((l) => l.id === over.id)
        return {
          ...m,
          lessons: arrayMove(m.lessons, oldIndex, newIndex).map((l, i) => ({
            ...l,
            sort_order: i,
          })),
        }
      }),
    })
  }

  function addOutcome() {
    emit({ ...data, learning_outcomes: [...data.learning_outcomes, ''] })
  }

  function updateOutcome(index: number, value: string) {
    const outcomes = data.learning_outcomes.map((o, i) => (i === index ? value : o))
    emit({ ...data, learning_outcomes: outcomes })
  }

  function removeOutcome(index: number) {
    emit({ ...data, learning_outcomes: data.learning_outcomes.filter((_, i) => i !== index) })
  }

  const courseProgress = computeCourseProgress(data)

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Course-level fields */}
      <div
        style={{
          background: 'var(--gem-well)',
          border: '1px solid var(--gem-border)',
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gem-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Informações do curso
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <EditField
              label="Público-alvo"
              value={data.target_audience}
              onChange={(v) => updateTopLevel({ target_audience: v })}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <EditSelect
              label="Dificuldade"
              value={data.difficulty}
              options={[
                { value: 'beginner', label: 'Iniciante' },
                { value: 'intermediate', label: 'Intermediário' },
                { value: 'advanced', label: 'Avançado' },
              ]}
              onChange={(v) =>
                updateTopLevel({
                  difficulty: v as CurriculumContent['difficulty'],
                })
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <EditSelect
              label="Modo"
              value={data.curriculum_mode}
              options={[
                { value: 'fixed', label: 'Sequencial' },
                { value: 'progressive', label: 'Progressivo' },
              ]}
              onChange={(v) =>
                updateTopLevel({
                  curriculum_mode: v as CurriculumContent['curriculum_mode'],
                })
              }
            />
          </div>
          <div style={{ width: 80 }}>
            <EditField
              label="Horas"
              value={data.estimated_hours}
              type="number"
              onChange={(v) => updateTopLevel({ estimated_hours: Number(v) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Learning outcomes */}
      <div
        style={{
          background: 'var(--gem-well)',
          border: '1px solid var(--gem-border)',
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gem-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          O que o aluno vai aprender
        </p>
        {data.learning_outcomes.map((outcome, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={outcome}
              onChange={(e) => updateOutcome(i, e.target.value)}
              style={{ ...INPUT_STYLE, flex: 1 }}
              placeholder="Descreva um resultado de aprendizagem"
            />
            <SmallButton label="×" color="#f87171" onClick={() => removeOutcome(i)} />
          </div>
        ))}
        <SmallButton label="+ Resultado" onClick={addOutcome} />
      </div>

      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--gem-dim)' }}>Progresso total:</span>
        <ProgressBar done={courseProgress.done} total={courseProgress.total} />
      </div>

      {/* Modules */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext
          items={data.modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.modules.map((mod) => (
              <SortableItem key={mod.id} id={mod.id}>
                <ModuleEditSection
                  mod={mod}
                  onUpdateModule={updateModule}
                  onRemoveModule={removeModule}
                  onUpdateLesson={updateLesson}
                  onRemoveLesson={removeLesson}
                  onAddLesson={addLesson}
                  onLessonDragEnd={handleLessonDragEnd}
                />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <SmallButton label="+ Adicionar módulo" onClick={addModule} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────

export function CurriculumRenderer({
  content,
  isEditing,
  onContentChange,
}: RendererProps) {
  const parsed = CurriculumContentSchema.safeParse(content)
  const data = parsed.success ? parsed.data : CurriculumContentSchema.parse({})

  const handleChange = useCallback(
    (updated: Record<string, unknown>) => {
      onContentChange(updated)
    },
    [onContentChange],
  )

  if (!isEditing) {
    return <ReadMode data={data} />
  }

  return <EditMode data={data} onContentChange={handleChange} />
}
