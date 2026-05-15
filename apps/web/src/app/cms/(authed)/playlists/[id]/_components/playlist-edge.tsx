'use client'

import type { PlaylistEdgeRow, EdgeType } from '@/lib/playlists/types'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import { edgePath, getConnectionPoints } from '@/lib/playlists/canvas/utils'

const EDGE_STYLES: Record<EdgeType, { stroke: string; glow: string; dash?: string; marker: 'arrow' | 'circle' | false; defaultLabel?: string }> = {
  sequence:     { stroke: '#818cf8', glow: 'rgba(129,140,248,0.15)', marker: 'arrow', defaultLabel: 'seq' },
  related:      { stroke: '#a855f7', glow: 'rgba(168,85,247,0.12)', dash: '5,3', marker: 'circle', defaultLabel: 'see also' },
  prerequisite: { stroke: '#fbbf24', glow: 'rgba(251,191,36,0.15)', marker: 'arrow', defaultLabel: 'read first' },
  continuation: { stroke: '#34d399', glow: 'rgba(52,211,153,0.15)', marker: 'arrow' },
}

interface PlaylistEdgeProps {
  edge: PlaylistEdgeRow
  sourceItem: PlaylistItemEnriched
  targetItem: PlaylistItemEnriched
  isSelected: boolean
  opacity?: number
  onSelect: (edgeId: string) => void
}

export function PlaylistEdge({
  edge,
  sourceItem,
  targetItem,
  isSelected,
  opacity,
  onSelect,
}: PlaylistEdgeProps) {
  const style = EDGE_STYLES[edge.edge_type]
  const { sourcePoint, targetPoint } = getConnectionPoints(sourceItem, targetItem)
  const path = edgePath(sourcePoint, targetPoint)
  const displayLabel = edge.label || style.defaultLabel
  const midX = (sourcePoint.x + targetPoint.x) / 2
  const midY = (sourcePoint.y + targetPoint.y) / 2

  return (
    <g aria-label={`${edge.edge_type} edge: ${sourceItem.title} → ${targetItem.title}`} style={{ opacity: opacity ?? 1 }}>
      {/* Fat invisible hit area */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth={10}
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={() => onSelect(edge.id)}
      />

      {/* Glow layer */}
      <path
        d={path}
        stroke={isSelected ? 'rgba(248,113,113,0.35)' : style.glow}
        strokeWidth={isSelected ? 8 : 6}
        fill="none"
        strokeDasharray={style.dash}
        style={{ pointerEvents: 'none' }}
      />

      {/* Visible edge */}
      <path
        d={path}
        stroke={isSelected ? '#f87171' : style.stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        fill="none"
        strokeDasharray={style.dash}
        markerEnd={
          style.marker === 'arrow'
            ? `url(#arrow-${isSelected ? 'selected' : edge.edge_type})`
            : style.marker === 'circle'
              ? 'url(#circle-related)'
              : undefined
        }
        style={{ pointerEvents: 'none' }}
      />

      {/* Label */}
      {displayLabel && (
        <foreignObject
          x={midX - 60}
          y={midY - 18}
          width={120}
          height={22}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <span
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: isSelected ? '#f87171' : style.stroke,
                background: 'rgba(10,10,18,0.92)',
                padding: '1px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {displayLabel}
            </span>
          </span>
        </foreignObject>
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
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
        >
          <path d="M1,1 L9,4 L1,7" fill="none" stroke={EDGE_STYLES[type].stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </marker>
      ))}
      <marker
        id="arrow-selected"
        markerWidth="10"
        markerHeight="8"
        refX="9"
        refY="4"
        orient="auto"
      >
        <path d="M1,1 L9,4 L1,7" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round" />
      </marker>
      <marker id="circle-related" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <circle cx="4" cy="4" r="3" fill="none" stroke="#a855f7" strokeWidth="1.5" />
      </marker>
    </defs>
  )
}
