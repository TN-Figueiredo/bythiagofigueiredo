'use client'

import { useCallback } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, SharedLinkSchema } from '@/app/go/linktree/_lib/types'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { IconPicker } from './icon-picker'
import { LangBadge } from './form-primitives'

type Config = z.infer<typeof LinktreeConfigSchema>
type SharedLink = z.infer<typeof SharedLinkSchema>

interface Props {
  config: Config
  onChange: (patch: Partial<Config>) => void
  readOnly: boolean
}

function SortableLinkCard({
  link, index, onUpdate, onDelete, readOnly,
}: {
  link: SharedLink
  index: number
  onUpdate: (index: number, patch: Partial<SharedLink>) => void
  onDelete: (index: number) => void
  readOnly: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  return (
    <div ref={setNodeRef} style={{ ...style, border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface-2)' }} {...attributes}>
      {/* Header: grip + icon picker + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" {...listeners} style={{ cursor: 'grab', color: 'var(--ink-faint)', background: 'none', border: 'none', padding: 0 }} disabled={readOnly} aria-label="Arrastar para reordenar">
          <GripVertical size={15} strokeWidth={1.7} />
        </button>
        <IconPicker value={link.icon} onChange={(icon) => onUpdate(index, { icon })} disabled={readOnly} />
        <button type="button" onClick={() => onDelete(index)} disabled={readOnly}
          style={{ color: 'var(--ink-faint)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto' }} aria-label="Remover link">
          <Trash2 size={15} strokeWidth={1.7} />
        </button>
      </div>
      {/* Labels grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--ink-dim)', marginBottom: 5 }}>
            Label <span className="mono" style={{ color: 'var(--accent)' }}>PT</span>
          </div>
          <input type="text" value={link.label_pt} onChange={(e) => onUpdate(index, { label_pt: e.target.value })}
            disabled={readOnly} maxLength={100} aria-label="Label em português" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
        </div>
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--ink-dim)', marginBottom: 5 }}>
            Label <span className="mono" style={{ color: 'var(--green)' }}>EN</span>
          </div>
          <input type="text" value={link.label_en} onChange={(e) => onUpdate(index, { label_en: e.target.value })}
            disabled={readOnly} maxLength={100} aria-label="Label em inglês" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 13, outline: 'none' }} className="disabled:opacity-50" />
        </div>
      </div>
      <div>
        <div style={{ fontSize: '10.5px', color: 'var(--ink-dim)', marginBottom: 5 }}>URL</div>
        <input type="url" value={link.url} onChange={(e) => onUpdate(index, { url: e.target.value })}
          disabled={readOnly} maxLength={2048} placeholder="https://..." aria-label="URL do link"
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 9, padding: '10px 12px', color: 'var(--ink)', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', outline: 'none' }} className="disabled:opacity-50" />
      </div>
    </div>
  )
}

export function SharedLinksSection({ config, onChange, readOnly }: Props) {
  const links = config.shared_links

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex((l) => l.id === active.id)
    const newIndex = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(config.shared_links, oldIndex, newIndex)
    onChange({ shared_links: reordered })
  }, [config.shared_links, links, onChange])

  const updateLink = useCallback((index: number, patch: Partial<SharedLink>) => {
    const updated = config.shared_links.map((l, i) => (i === index ? { ...l, ...patch } : l))
    onChange({ shared_links: updated })
  }, [config.shared_links, onChange])

  const deleteLink = useCallback((index: number) => {
    onChange({ shared_links: config.shared_links.filter((_, i) => i !== index) })
  }, [config.shared_links, onChange])

  const addLink = useCallback(() => {
    if (config.shared_links.length >= 10) return
    onChange({
      shared_links: [...config.shared_links, { id: crypto.randomUUID(), label_pt: '', label_en: '', url: '', icon: 'link-2' }],
    })
  }, [config.shared_links, onChange])

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 12, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Shared Links · {config.shared_links.length}/10</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {links.map((link, i) => (
              <SortableLinkCard key={link.id} link={link} index={i} onUpdate={updateLink} onDelete={deleteLink} readOnly={readOnly} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {config.shared_links.length < 10 && (
        <button
          type="button"
          onClick={addLink}
          disabled={readOnly}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
            padding: '9px 15px', fontSize: '13.5px', fontWeight: 600,
            borderRadius: 9, border: '1px solid var(--line)',
            background: 'var(--surface-2)', color: 'var(--ink)',
            letterSpacing: '-0.01em', whiteSpace: 'nowrap', cursor: 'pointer',
            marginTop: 12,
          }}
        >
          <Plus size={16} strokeWidth={1.7} /> Adicionar link
        </button>
      )}
    </section>
  )
}
