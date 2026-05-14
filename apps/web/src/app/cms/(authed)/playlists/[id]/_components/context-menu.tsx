'use client'

import { useEffect, useRef } from 'react'
import type { ContentType } from '@/lib/playlists/types'

/* ------------------------------------------------------------------ */
/*  Badge labels & colours per content type                            */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<ContentType, { label: string; bg: string }> = {
  blog_post: { label: 'BLOG', bg: 'bg-indigo-500' },
  newsletter: { label: 'NEWS', bg: 'bg-green-500' },
  pipeline: { label: 'PIPE', bg: 'bg-purple-500' },
  video: { label: 'VIDEO', bg: 'bg-rose-500' },
}

/* ------------------------------------------------------------------ */
/*  Relative date helper                                               */
/* ------------------------------------------------------------------ */

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/* ------------------------------------------------------------------ */
/*  Inline SVG icons (12x12)                                           */
/* ------------------------------------------------------------------ */

function IconExternalLink() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6.5v3a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H5.5" />
      <path d="M7 1.5h3.5V5" />
      <path d="M5 7 10.5 1.5" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <path d="M8 4V2.5a1 1 0 0 0-1-1H2.5a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1H4" />
    </svg>
  )
}

function IconEdge() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="9" r="1.5" />
      <circle cx="9" cy="3" r="1.5" />
      <path d="M4.2 7.8 7.8 4.2" />
    </svg>
  )
}

function IconSelect() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" strokeDasharray="2 2" />
    </svg>
  )
}

function IconMove() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5v9M1.5 6h9" />
      <path d="M4 3.5 6 1.5l2 2M4 8.5 6 10.5l2-2M3.5 4 1.5 6l2 2M8.5 4 10.5 6l-2 2" />
    </svg>
  )
}

function IconPlaylist() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3h9M1.5 6h6M1.5 9h4" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3h9M4.5 3V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Menu item component                                                */
/* ------------------------------------------------------------------ */

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  variant?: 'default' | 'danger'
  onClick: () => void
}

function MenuItem({ icon, label, shortcut, variant = 'default', onClick }: MenuItemProps) {
  const isDanger = variant === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
        isDanger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-white/70 hover:bg-white/5 hover:text-white/90'
      }`}
    >
      <span className="flex-none">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <span className="flex-none text-[10px] text-white/30">{shortcut}</span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  PlaylistContextMenu (new rich component)                           */
/* ------------------------------------------------------------------ */

export interface PlaylistContextMenuProps {
  x: number
  y: number
  itemId: string
  itemTitle: string
  contentType: ContentType | null
  viewNumber: number | null
  createdAt: string
  onClose: () => void
  onOpenEditor: () => void
  onCopyId: () => void
  onAddEdge: () => void
  onSelectConnected: () => void
  onMoveToPosition: () => void
  onShowOtherPlaylists: () => void
  onRemove: () => void
}

export function PlaylistContextMenu({
  x,
  y,
  itemId,
  itemTitle,
  contentType,
  viewNumber,
  createdAt,
  onClose,
  onOpenEditor,
  onCopyId,
  onAddEdge,
  onSelectConnected,
  onMoveToPosition,
  onShowOtherPlaylists,
  onRemove,
}: PlaylistContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  /* Close on ESC or click outside */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  /* Auto-reposition if off-screen */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`
    }
  }, [x, y])

  const meta = contentType ? TYPE_META[contentType] : null
  const truncatedId = itemId.length > 12 ? `${itemId.slice(0, 12)}...` : itemId

  return (
    <div
      ref={ref}
      data-testid="context-menu"
      className="fixed z-50 w-[200px] rounded-xl border border-white/10 bg-[#14141f]/90 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {/* ---- Header ---- */}
      <div className="flex items-center gap-1.5 border-b border-white/5 px-2.5 py-2">
        {meta && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${meta.bg}`}>
            {meta.label}
          </span>
        )}
        {viewNumber !== null && (
          <span className="text-[10px] text-white/40">#{viewNumber}</span>
        )}
        <span className="flex-1 truncate text-xs font-medium text-white/90">
          {itemTitle}
        </span>
      </div>

      {/* ---- Section 1: Navigation ---- */}
      <div className="p-1">
        <MenuItem icon={<IconExternalLink />} label="Open in editor" shortcut="⌘↵" onClick={onOpenEditor} />
        <MenuItem icon={<IconCopy />} label="Copy ID" shortcut="⌘C" onClick={onCopyId} />
      </div>

      <div className="mx-2 border-t border-white/5" />

      {/* ---- Section 2: Graph actions ---- */}
      <div className="p-1">
        <MenuItem icon={<IconEdge />} label="Add edge from here" shortcut="E" onClick={onAddEdge} />
        <MenuItem icon={<IconSelect />} label="Select connected" shortcut="⌘A" onClick={onSelectConnected} />
        <MenuItem icon={<IconMove />} label="Move to position…" shortcut="M" onClick={onMoveToPosition} />
        <MenuItem icon={<IconPlaylist />} label="Other playlists" shortcut="N" onClick={onShowOtherPlaylists} />
      </div>

      <div className="mx-2 border-t border-white/5" />

      {/* ---- Section 3: Danger zone ---- */}
      <div className="p-1">
        <MenuItem icon={<IconTrash />} label="Remove from playlist" shortcut="⌫" variant="danger" onClick={onRemove} />
      </div>

      {/* ---- Footer ---- */}
      <div className="flex items-center justify-between border-t border-white/5 px-2.5 py-1.5">
        <span className="font-mono text-[9px] text-white/25">{truncatedId}</span>
        <span className="text-[9px] text-white/25">{formatRelative(createdAt)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Legacy ContextMenu shim (used by canvas.tsx until Task 13)         */
/* ------------------------------------------------------------------ */

interface ContextMenuLegacyProps {
  x: number
  y: number
  items: Array<{ label: string; onClick: () => void; variant?: string }>
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuLegacyProps) {
  return (
    <div
      className="fixed z-50 w-[160px] rounded-lg border border-white/10 bg-[#14141f]/90 p-1 shadow-xl backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => { item.onClick(); onClose() }}
          className={`flex w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
            item.variant === 'danger' ? 'text-red-400 hover:bg-red-500/10' : 'text-white/70 hover:bg-white/5'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
