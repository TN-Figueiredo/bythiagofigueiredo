'use client'

import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import { NODE_WIDTH, NODE_HEIGHT, type Camera } from '@/lib/playlists/canvas'

interface PlaylistMinimapProps {
  items: PlaylistItemEnriched[]
  camera: Camera
  viewportWidth: number
  viewportHeight: number
  onNavigate: (x: number, y: number) => void
}

export function PlaylistMinimap({
  items,
  camera,
  viewportWidth,
  viewportHeight,
  onNavigate,
}: PlaylistMinimapProps) {
  if (items.length === 0) return null

  const MINIMAP_W = 130
  const MINIMAP_H = 80
  const PADDING = 20

  const minX = Math.min(...items.map(i => i.position_x)) - PADDING
  const maxX = Math.max(...items.map(i => i.position_x)) + NODE_WIDTH + PADDING
  const minY = Math.min(...items.map(i => i.position_y)) - PADDING
  const maxY = Math.max(...items.map(i => i.position_y)) + NODE_HEIGHT + PADDING

  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)
  const scale = Math.min(MINIMAP_W / contentW, MINIMAP_H / contentH)

  // Viewport indicator in content coords
  const vpX = -camera.x / camera.zoom
  const vpY = -camera.y / camera.zoom
  const vpW = viewportWidth / camera.zoom
  const vpH = viewportHeight / camera.zoom

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / scale + minX
    const clickY = (e.clientY - rect.top) / scale + minY
    onNavigate(clickX, clickY)
  }

  const typeColors: Record<string, string> = {
    blog_post: '#818cf8',
    newsletter: '#34d399',
    pipeline: '#a855f7',
    video: '#ef4444',
  }

  return (
    <div className="absolute bottom-3 right-3 z-10 overflow-hidden rounded-lg border border-white/10 bg-[#0a0a12]/80 shadow-xl backdrop-blur-sm">
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        onClick={handleClick}
        className="cursor-crosshair"
      >
        {/* Mini nodes */}
        {items.map(item => (
          <rect
            key={item.id}
            x={(item.position_x - minX) * scale}
            y={(item.position_y - minY) * scale}
            width={NODE_WIDTH * scale}
            height={NODE_HEIGHT * scale}
            rx={2}
            fill={item.is_ghost ? '#ffffff10' : (typeColors[item.content_type ?? ''] ?? '#ffffff20')}
            opacity={0.7}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={(vpX - minX) * scale}
          y={(vpY - minY) * scale}
          width={vpW * scale}
          height={vpH * scale}
          fill="none"
          stroke="#818cf8"
          strokeWidth={1.5}
          opacity={0.6}
          rx={1}
        />
      </svg>
    </div>
  )
}
