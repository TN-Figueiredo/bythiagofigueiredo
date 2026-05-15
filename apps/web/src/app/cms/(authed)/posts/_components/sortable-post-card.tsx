'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PostCard, type PostBoardItem } from './post-card'

interface SortablePostCardProps {
  item: PostBoardItem
}

export function SortablePostCard({ item }: SortablePostCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
      {...attributes}
      {...listeners}
    >
      <PostCard item={item} isDragging={isDragging} />
    </div>
  )
}
