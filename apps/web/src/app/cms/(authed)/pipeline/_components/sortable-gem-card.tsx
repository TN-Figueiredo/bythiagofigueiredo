'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { GemCard, type GemCardItem } from './gem-card'

interface SortableGemCardProps {
  item: GemCardItem
  onPromote?: (itemId: string) => void
}

export function SortableGemCard({ item, onPromote }: SortableGemCardProps) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GemCard
        item={item}
        isDragging={isDragging}
        onNavigate={() => router.push(`/cms/pipeline/items/${item.id}`)}
        onPromote={onPromote}
      />
    </div>
  )
}
