'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_STYLES: Record<ContentType, { bg: string; border: string; badge: string; badgeBg: string; headerBg: string }> = {
  blog_post: {
    bg: 'bg-indigo-500/[0.08]',
    border: 'border-indigo-500/25',
    badge: 'BLOG',
    badgeBg: 'bg-indigo-500',
    headerBg: 'bg-indigo-500/10',
  },
  newsletter: {
    bg: 'bg-green-500/[0.08]',
    border: 'border-green-500/25',
    badge: 'NEWS',
    badgeBg: 'bg-green-500',
    headerBg: 'bg-green-500/10',
  },
  pipeline: {
    bg: 'bg-purple-500/[0.08]',
    border: 'border-purple-500/25',
    badge: 'PIPE',
    badgeBg: 'bg-purple-500',
    headerBg: 'bg-purple-500/10',
  },
}

interface PlaylistNodeProps {
  item: PlaylistItemEnriched
  isSelected: boolean
  isDropTarget: boolean
  onPointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onHandlePointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onContextMenu: (e: React.MouseEvent, itemId: string) => void
  onClick: (e: Pick<React.MouseEvent, 'shiftKey'>, itemId: string) => void
}

export function PlaylistNode({
  item,
  isSelected,
  isDropTarget,
  onPointerDown,
  onHandlePointerDown,
  onContextMenu,
  onClick,
}: PlaylistNodeProps) {
  const style = item.is_ghost
    ? null
    : item.content_type
      ? TYPE_STYLES[item.content_type]
      : null

  const ghostClasses = item.is_ghost
    ? 'border-dashed border-white/20 bg-white/[0.02]'
    : ''

  const selectedRing = isSelected
    ? 'ring-2 ring-indigo-500/50 shadow-lg shadow-black/30'
    : isDropTarget
      ? 'ring-2 ring-indigo-400/40 shadow-lg shadow-indigo-500/20'
      : ''

  return (
    <div
      data-node-id={item.id}
      data-pos-x={item.position_x}
      data-pos-y={item.position_y}
      role="button"
      aria-label={`${item.content_type ?? 'Ghost'}: ${item.title}, ${item.status ?? 'removed'}`}
      tabIndex={0}
      className={`group absolute min-w-[160px] cursor-grab rounded-xl border-2 ${style?.bg ?? ''} ${style?.border ?? ''} ${ghostClasses} ${selectedRing} select-none transition-shadow`}
      style={{ transform: `translate(${item.position_x}px, ${item.position_y}px)` }}
      onPointerDown={e => onPointerDown(e, item.id, item.position_x, item.position_y)}
      onContextMenu={e => {
        e.preventDefault()
        onContextMenu(e, item.id)
      }}
      onClick={e => onClick(e, item.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick({ shiftKey: e.shiftKey }, item.id)
        }
      }}
    >
      {/* Top handle */}
      <div
        data-handle-id={item.id}
        className={`absolute top-[-6px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
        onPointerDown={e => {
          onHandlePointerDown(e, item.id, item.position_x + 80, item.position_y)
        }}
      />

      {/* Bottom handle */}
      <div
        data-handle-id={item.id}
        className={`absolute bottom-[-6px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
        onPointerDown={e => {
          onHandlePointerDown(e, item.id, item.position_x + 80, item.position_y + 80)
        }}
      />

      {/* Left handle */}
      <div
        data-handle-id={item.id}
        className={`absolute left-[-6px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
        onPointerDown={e => {
          onHandlePointerDown(e, item.id, item.position_x, item.position_y + 40)
        }}
      />

      {/* Right handle */}
      <div
        data-handle-id={item.id}
        className={`absolute right-[-6px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] ${style?.badgeBg ?? 'bg-white/30'} opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
        onPointerDown={e => {
          onHandlePointerDown(e, item.id, item.position_x + 160, item.position_y + 40)
        }}
      />

      {/* Header */}
      {style && !item.is_ghost && (
        <div className={`flex items-center gap-1.5 rounded-t-[9px] px-2.5 py-1 text-[0.62rem] ${style.headerBg}`}>
          <span className={`rounded px-1.5 py-px text-[0.6rem] font-bold text-white ${style.badgeBg}`}>
            {style.badge}
          </span>
          <span className="text-white/40">{item.category ?? ''}</span>
        </div>
      )}

      {/* Body */}
      <div className="px-2.5 py-1.5">
        <h4 className={`text-sm font-semibold ${item.is_ghost ? 'text-white/30' : 'text-white'}`}>
          {item.title}
        </h4>
        <p className="mt-0.5 text-[0.65rem] text-white/40">
          {item.status ?? ''}{item.metadata ? ` · ${item.metadata}` : ''}
        </p>
      </div>

      {/* Cross-playlist badge */}
      {item.other_playlist_count > 0 && (
        <div className="border-t border-white/5 px-2.5 py-1 text-[0.62rem] text-white/30">
          +{item.other_playlist_count} playlist{item.other_playlist_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
