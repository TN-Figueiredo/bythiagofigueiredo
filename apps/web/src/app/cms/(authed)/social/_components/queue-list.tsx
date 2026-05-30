'use client'

import { useState, useCallback, useRef } from 'react'
import { useOptimistic } from 'react'
import Link from 'next/link'
import { reorderQueue } from '@/lib/social/actions'
import { socialToast } from './shared/social-toast'

interface QueueItem {
  id: string
  title: string
  queuePosition: number
  scheduledAt: string | null
  status: string
}

interface QueueListProps {
  initialItems: QueueItem[]
}

export function QueueList({ initialItems }: QueueListProps) {
  const [items, setItems] = useState(initialItems)
  const [optimisticItems, setOptimisticItems] = useOptimistic(items)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const moveItem = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const item = items[fromIndex]
    if (!item) return
    const newItems = [...items]
    newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, item)
    const reindexed = newItems.map((it, i) => ({ ...it, queuePosition: i }))

    setOptimisticItems(reindexed)
    const result = await reorderQueue(item.id, toIndex)
    if (result.ok) {
      setItems(reindexed)
      socialToast('queue_reordered')
    } else {
      setOptimisticItems(items)
    }
  }, [items, setOptimisticItems])

  function handlePointerDown(e: React.PointerEvent, index: number) {
    if ((e.target as HTMLElement).dataset.handle !== 'true') return
    e.preventDefault()
    setDraggingId(items[index]?.id ?? null)
    setFocusedIndex(index)

    const startY = e.clientY
    const itemHeight = 64

    function onPointerMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientY - startY
      const offset = Math.round(delta / itemHeight)
      const newIndex = Math.max(0, Math.min(items.length - 1, index + offset))
      setFocusedIndex(newIndex)
    }

    function onPointerUp(upEvent: PointerEvent) {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      setDraggingId(null)

      const delta = upEvent.clientY - startY
      const offset = Math.round(delta / itemHeight)
      const newIndex = Math.max(0, Math.min(items.length - 1, index + offset))
      if (newIndex !== index) moveItem(index, newIndex)
      setFocusedIndex(null)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      moveItem(index, index - 1)
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault()
      moveItem(index, index + 1)
    }
  }

  return (
    <div ref={listRef} className="space-y-1" role="list">
      {optimisticItems.map((item, index) => (
        <div
          key={item.id}
          role="listitem"
          className={`flex items-center gap-3 rounded-lg border bg-cms-surface px-3 py-3 transition-all ${
            draggingId === item.id ? 'border-cms-accent shadow-md scale-[1.02]' : 'border-cms-border'
          } ${focusedIndex === index && draggingId ? 'ring-2 ring-cms-accent/30' : ''}`}
          onKeyDown={(e) => handleKeyDown(e, index)}
          tabIndex={0}
        >
          {/* Drag handle */}
          <button
            data-handle="true"
            onPointerDown={(e) => handlePointerDown(e, index)}
            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded text-cms-text-dim hover:text-cms-text active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            aria-label={`Arrastar ${item.title}`}
          >
            &#8942;&#8942;
          </button>

          {/* Position number */}
          <span className="w-6 shrink-0 text-center text-xs font-mono text-cms-text-dim">
            {index + 1}
          </span>

          {/* Content */}
          <Link href={`/cms/social/${item.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-cms-text">{item.title}</p>
            <p className="text-xs text-cms-text-muted">
              {item.scheduledAt
                ? new Date(item.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Sem data'}
            </p>
          </Link>
        </div>
      ))}
    </div>
  )
}
