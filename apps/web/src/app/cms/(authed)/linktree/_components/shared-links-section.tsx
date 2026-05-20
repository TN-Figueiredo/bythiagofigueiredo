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
    <div ref={setNodeRef} style={style} {...attributes}
      className="rounded border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" disabled={readOnly} aria-label="Arrastar para reordenar">
          <GripVertical size={14} />
        </button>
        <IconPicker value={link.icon} onChange={(icon) => onUpdate(index, { icon })} disabled={readOnly} />
        <div className="flex-1" />
        <button type="button" onClick={() => onDelete(index)} disabled={readOnly}
          className="text-muted-foreground hover:text-red-400 disabled:opacity-50" aria-label="Remover link">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-0.5 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Label</span>
            <LangBadge lang="PT" />
          </div>
          <input type="text" value={link.label_pt} onChange={(e) => onUpdate(index, { label_pt: e.target.value })}
            disabled={readOnly} aria-label="Label em português" className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
        </div>
        <div>
          <div className="mb-0.5 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Label</span>
            <LangBadge lang="EN" />
          </div>
          <input type="text" value={link.label_en} onChange={(e) => onUpdate(index, { label_en: e.target.value })}
            disabled={readOnly} aria-label="Label em inglês" className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
        </div>
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-muted-foreground">URL</span>
        <input type="url" value={link.url} onChange={(e) => onUpdate(index, { url: e.target.value })}
          disabled={readOnly} placeholder="https://..." aria-label="URL do link"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50" />
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
      <h2 className="mb-4 text-sm font-bold text-foreground">Shared Links</h2>
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
        <button type="button" onClick={addLink} disabled={readOnly}
          className="mt-3 flex items-center gap-1.5 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50">
          <Plus size={14} /> Adicionar link
        </button>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">{config.shared_links.length}/10 links</p>
    </section>
  )
}
