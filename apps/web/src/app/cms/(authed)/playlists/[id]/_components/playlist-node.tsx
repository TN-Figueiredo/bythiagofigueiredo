'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_CONFIG: Record<ContentType, {
  gradient: [string, string]
  badge: string
  borderColor: string
  glowColor: string
}> = {
  video:      { gradient: ['#ef4444', '#dc2626'], badge: 'VIDEO', borderColor: '#ef4444', glowColor: 'rgba(239,68,68,0.20)' },
  blog_post:  { gradient: ['#6366f1', '#4f46e5'], badge: 'BLOG',  borderColor: '#6366f1', glowColor: 'rgba(99,102,241,0.20)' },
  newsletter: { gradient: ['#22c55e', '#16a34a'], badge: 'NEWS',  borderColor: '#22c55e', glowColor: 'rgba(34,197,94,0.20)' },
  pipeline:   { gradient: ['#a855f7', '#9333ea'], badge: 'PIPE',  borderColor: '#a855f7', glowColor: 'rgba(168,85,247,0.20)' },
}

const LANG_CONFIG = {
  'pt-br': { label: 'PT', bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
  en:      { label: 'EN', bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
} as const

const NODE_W = 250

interface PlaylistNodeProps {
  item: PlaylistItemEnriched
  isSelected: boolean
  isDropTarget: boolean
  isDimmed: boolean
  isIdea: boolean
  viewNumber: number | null
  onPointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onHandlePointerDown: (e: React.PointerEvent, itemId: string, x: number, y: number) => void
  onContextMenu: (e: React.MouseEvent, itemId: string) => void
  onClick: (e: Pick<React.MouseEvent, 'shiftKey'>, itemId: string) => void
  onOpenContent: (itemId: string) => void
}

export function PlaylistNode({
  item, isSelected, isDropTarget, isDimmed, isIdea, viewNumber,
  onPointerDown, onHandlePointerDown, onContextMenu, onClick, onOpenContent,
}: PlaylistNodeProps) {
  const typeConfig = item.content_type ? TYPE_CONFIG[item.content_type] : null
  const langConfig = item.language ? LANG_CONFIG[item.language] : null
  const borderColor = typeConfig?.borderColor ?? '#ffffff20'

  const stateClasses = isDimmed
    ? 'opacity-[0.12] saturate-[0.15] pointer-events-none'
    : isIdea
      ? 'opacity-55 saturate-[0.6]'
      : ''

  const selectionClasses = isSelected
    ? 'ring-2 ring-offset-1 ring-offset-transparent shadow-lg'
    : isDropTarget
      ? 'ring-2 ring-offset-1 ring-offset-transparent shadow-lg'
      : ''

  return (
    <div
      data-node-id={item.id}
      data-pos-x={item.position_x}
      data-pos-y={item.position_y}
      role="button"
      aria-label={`${typeConfig?.badge ?? 'Ghost'}: ${item.title}, ${item.status ?? 'removed'}`}
      tabIndex={0}
      className={`group absolute flex max-w-[250px] min-w-[200px] cursor-grab rounded-xl border-[1.5px] select-none transition-shadow ${stateClasses} ${selectionClasses} ${item.is_ghost ? 'border-dashed border-white/20 bg-white/[0.02]' : ''}`}
      style={{
        transform: `translate(${item.position_x}px, ${item.position_y}px)`,
        borderColor: item.is_ghost ? undefined : borderColor,
        boxShadow: isSelected
          ? `0 0 0 2.5px ${typeConfig?.glowColor ?? 'rgba(255,255,255,0.1)'}, 0 1px 3px rgba(0,0,0,0.3)`
          : '0 1px 3px rgba(0,0,0,0.3)',
      }}
      onPointerDown={e => onPointerDown(e, item.id, item.position_x, item.position_y)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, item.id) }}
      onClick={e => onClick(e, item.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick({ shiftKey: e.shiftKey }, item.id) } }}
    >
      {/* Connection handles */}
      {([
        { pos: 'top-[-6px] left-1/2 -translate-x-1/2', hx: item.position_x + NODE_W / 2, hy: item.position_y },
        { pos: 'bottom-[-6px] left-1/2 -translate-x-1/2', hx: item.position_x + NODE_W / 2, hy: item.position_y + 80 },
        { pos: 'left-[-6px] top-1/2 -translate-y-1/2', hx: item.position_x, hy: item.position_y + 40 },
        { pos: 'right-[-6px] top-1/2 -translate-y-1/2', hx: item.position_x + NODE_W, hy: item.position_y + 40 },
      ] as const).map((h, i) => (
        <div
          key={i}
          data-handle-id={item.id}
          className={`absolute ${h.pos} h-[11px] w-[11px] cursor-crosshair rounded-full border-[2.5px] border-[var(--bg,#0a0a12)] opacity-0 transition-all group-hover:scale-110 group-hover:opacity-100 hover:!scale-150`}
          style={{ backgroundColor: typeConfig?.borderColor ?? '#ffffff30' }}
          onPointerDown={e => onHandlePointerDown(e, item.id, h.hx, h.hy)}
        />
      ))}

      {/* Left stripe with order number */}
      <div
        className="flex w-[26px] flex-shrink-0 items-center justify-center rounded-l-[9px] text-xs font-bold text-white"
        style={{
          background: typeConfig
            ? `linear-gradient(180deg, ${typeConfig.gradient[0]}, ${typeConfig.gradient[1]})`
            : '#333',
          minHeight: '100%',
        }}
      >
        {viewNumber !== null ? viewNumber : '---'}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        {typeConfig && !item.is_ghost && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-[0.62rem]" style={{ backgroundColor: `${typeConfig.borderColor}10` }}>
            <span className="rounded px-1 py-px text-[0.6rem] font-bold text-white" style={{ backgroundColor: typeConfig.borderColor }}>
              {typeConfig.badge}
            </span>
            {langConfig && (
              <span className="rounded px-1 py-px text-[0.6rem] font-semibold" style={{ backgroundColor: langConfig.bg, color: langConfig.color }}>
                {langConfig.label}
              </span>
            )}
            <span className="flex-1 truncate text-white/40">{item.category ?? ''}</span>
            <button
              type="button"
              aria-label="Open in editor"
              className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
              onClick={e => { e.stopPropagation(); onOpenContent(item.id) }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-2 py-1.5">
          <h4
            data-testid="node-title"
            className={`line-clamp-2 text-sm font-semibold leading-tight ${item.is_ghost ? 'text-white/30' : 'text-white'}`}
          >
            {item.title}
          </h4>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1 border-t border-white/5 px-2 py-1 text-[0.62rem] text-white/40">
          {item.status && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.status === 'published' ? '#22c55e' : item.status === 'draft' ? '#fbbf24' : '#6b7280' }} />
              {item.status}
            </span>
          )}
          {item.other_playlist_count > 0 && (
            <>
              {item.status && <span className="text-white/20">&middot;</span>}
              <span>+{item.other_playlist_count} playlist{item.other_playlist_count > 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Pipeline version badge */}
        {(item.content_type === 'pipeline' || item.content_type === 'video') && item.metadata && (
          <div className="px-2 pb-1.5">
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[0.55rem] font-semibold text-purple-400">
              {item.metadata}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
