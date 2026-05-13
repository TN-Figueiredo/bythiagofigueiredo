'use client'

import type { PlaylistEdgeRow, EdgeType } from '@/lib/playlists/types'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import { edgePath } from '@/lib/playlists/canvas/utils'

const EDGE_STYLES: Record<EdgeType, { stroke: string; dash?: string; marker: boolean; defaultLabel?: string }> = {
  sequence: { stroke: '#818cf8', marker: true },
  related: { stroke: '#4b5563', dash: '5,3', marker: false, defaultLabel: 'veja também' },
  prerequisite: { stroke: '#fbbf24', dash: '8,3', marker: true, defaultLabel: 'leia antes' },
  continuation: { stroke: '#34d399', marker: true },
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

interface PlaylistEdgeProps {
  edge: PlaylistEdgeRow
  sourceItem: PlaylistItemEnriched
  targetItem: PlaylistItemEnriched
  isSelected: boolean
  onSelect: (edgeId: string) => void
}

export function PlaylistEdge({
  edge,
  sourceItem,
  targetItem,
  isSelected,
  onSelect,
}: PlaylistEdgeProps) {
  const style = EDGE_STYLES[edge.edge_type]

  const sourcePoint = {
    x: sourceItem.position_x + NODE_WIDTH,
    y: sourceItem.position_y + NODE_HEIGHT / 2,
  }
  const targetPoint = {
    x: targetItem.position_x,
    y: targetItem.position_y + NODE_HEIGHT / 2,
  }

  const path = edgePath(sourcePoint, targetPoint)
  const displayLabel = edge.label || style.defaultLabel

  const midX = (sourcePoint.x + targetPoint.x) / 2
  const midY = (sourcePoint.y + targetPoint.y) / 2

  return (
    <g>
      {/* Fat invisible hit area */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={() => onSelect(edge.id)}
      />

      {/* Visible edge */}
      <path
        d={path}
        stroke={isSelected ? '#f87171' : style.stroke}
        strokeWidth={isSelected ? 3 : 2}
        fill="none"
        strokeDasharray={style.dash}
        markerEnd={style.marker ? `url(#arrow-${edge.edge_type})` : undefined}
        style={{ pointerEvents: 'none', filter: isSelected ? 'drop-shadow(0 0 4px rgba(248,113,113,0.4))' : undefined }}
      />

      {/* Label */}
      {displayLabel && (
        <text
          x={midX}
          y={midY - 8}
          fill={style.stroke}
          fontSize={9}
          fontFamily="-apple-system, sans-serif"
          fontStyle="italic"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {displayLabel}
        </text>
      )}
    </g>
  )
}

export function EdgeArrowDefs() {
  return (
    <defs>
      {(['sequence', 'prerequisite', 'continuation'] as const).map(type => (
        <marker
          key={type}
          id={`arrow-${type}`}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6" fill={EDGE_STYLES[type].stroke} />
        </marker>
      ))}
    </defs>
  )
}
