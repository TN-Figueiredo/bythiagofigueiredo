'use client'

import { useState, useCallback, useRef, useTransition } from 'react'
import { useOptimistic } from 'react'
import Link from 'next/link'
import { reorderQueue } from '@/lib/social/actions'
import { socialToast } from './shared/social-toast'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QueueItem {
  id: string
  title: string
  queuePosition: number
  scheduledAt: string | null
  status: string
  provider: string
  surface: string
  destLabel: string
}

interface QueueListProps {
  initialItems: QueueItem[]
}

/* ------------------------------------------------------------------ */
/*  Platform icon (32x32, solid bg, white SVG)                         */
/* ------------------------------------------------------------------ */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E8823C',
  youtube: '#E0574E',
  facebook: '#5B7FD6',
  bluesky: '#0085FF',
}

function PlatformIcon({ provider }: { provider: string }) {
  const bg = PLATFORM_COLORS[provider] ?? '#888'

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
      style={{ background: bg }}
    >
      {provider === 'instagram' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
        </svg>
      )}
      {provider === 'youtube' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <path d="M10 9l5 3-5 3z" fill="#fff" stroke="none" />
        </svg>
      )}
      {provider === 'facebook' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
        </svg>
      )}
      {provider === 'bluesky' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <path d="M12 4c3 2.5 6 6 6 8.5a3.5 3.5 0 01-7 0" />
          <path d="M12 4c-3 2.5-6 6-6 8.5a3.5 3.5 0 007 0" />
          <path d="M8.5 17c1-.5 2.5-1 3.5-1s2.5.5 3.5 1" />
        </svg>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Schedule formatter                                                 */
/* ------------------------------------------------------------------ */

function formatSchedule(scheduledAt: string | null): string {
  if (!scheduledAt) return 'Sem data'

  const date = new Date(scheduledAt)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Hoje · ${time}`
  if (isTomorrow) return `Amanha · ${time}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${time}`
}

/* ------------------------------------------------------------------ */
/*  QueueList component                                                */
/* ------------------------------------------------------------------ */

export function QueueList({ initialItems }: QueueListProps) {
  const [items, setItems] = useState(initialItems)
  const [optimisticItems, setOptimisticItems] = useOptimistic(items)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [, startTransition] = useTransition()

  const moveItem = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const item = items[fromIndex]
    if (!item) return
    const newItems = [...items]
    newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, item)
    const reindexed = newItems.map((it, i) => ({ ...it, queuePosition: i }))

    startTransition(async () => {
      setOptimisticItems(reindexed)
      const result = await reorderQueue(item.id, toIndex)
      if (result.ok) {
        setItems(reindexed)
        socialToast('queue_reordered')
      }
      // On failure, useOptimistic automatically reverts when transition ends
    })
  }, [items, setOptimisticItems, startTransition])

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
    <div className="max-w-[720px]">
      {/* Info banner */}
      <div className="mb-4 flex items-center gap-[9px] rounded-[11px] border border-cms-border bg-[var(--surface-2)] px-[15px] py-3">
        {/* Queue icon: 3 horizontal lines */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-cms-accent, currentColor)"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
        >
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
        <span className="text-[12.5px] text-cms-text-dim">
          A fila publica nos seus melhores horarios, na ordem. Arraste pra reordenar.
        </span>
      </div>

      {/* Queue items */}
      <div ref={listRef} className="flex flex-col gap-[10px]" role="list">
        {optimisticItems.map((item, index) => (
          <div
            key={item.id}
            role="listitem"
            className={`flex items-center gap-[13px] rounded-[var(--radius,12px)] border bg-cms-surface p-[14px] transition-all ${
              draggingId === item.id ? 'border-cms-accent shadow-md scale-[1.02]' : 'border-cms-border'
            } ${focusedIndex === index && draggingId ? 'ring-2 ring-cms-accent/30' : ''}`}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={0}
          >
            {/* 1. Drag handle — 6-dot grip */}
            <button
              data-handle="true"
              onPointerDown={(e) => handlePointerDown(e, index)}
              className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded text-[var(--ink-faint)] hover:text-cms-text-dim active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              aria-label={`Arrastar ${item.title}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="pointer-events-none"
              >
                <path d="M9 5h.01" />
                <path d="M9 12h.01" />
                <path d="M9 19h.01" />
                <path d="M15 5h.01" />
                <path d="M15 12h.01" />
                <path d="M15 19h.01" />
              </svg>
            </button>

            {/* 2. Position number */}
            <span className="w-[18px] shrink-0 text-center font-mono text-xs text-[var(--ink-faint)]">
              {index + 1}
            </span>

            {/* 3. Platform icon */}
            <PlatformIcon provider={item.provider} />

            {/* 4. Content */}
            <Link href={`/cms/social/${item.id}`} className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-cms-text">
                {item.title}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-cms-text-dim">
                {[item.destLabel, item.surface, 'PT'].filter(Boolean).join(' · ')}
              </p>
            </Link>

            {/* 5. Schedule time */}
            <div className="hidden shrink-0 items-center gap-1.5 text-xs text-cms-text-dim sm:inline-flex">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {formatSchedule(item.scheduledAt)}
            </div>

            {/* 6. Chevron right */}
            <Link
              href={`/cms/social/${item.id}`}
              className="shrink-0 text-[var(--ink-faint)]"
              aria-label={`Abrir ${item.title}`}
              tabIndex={-1}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
