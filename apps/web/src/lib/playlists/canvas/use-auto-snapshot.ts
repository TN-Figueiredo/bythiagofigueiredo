'use client'

import { useEffect, useRef } from 'react'
import { computeGraphHash } from './graph-hash'
import type { PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'

const AUTO_SNAPSHOT_INTERVAL_S = 300
const SAVE_TRANSITION_TIME_S = 1.5

interface UseAutoSnapshotOptions {
  playlistId: string
  siteId: string
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  saveState: 'saved' | 'saving' | 'error'
  enabled: boolean
  onCreateSnapshot: (siteId: string, playlistId: string, type: 'auto', label: string) => Promise<unknown>
}

export function useAutoSnapshot({
  playlistId,
  siteId,
  items,
  edges,
  saveState,
  enabled,
  onCreateSnapshot,
}: UseAutoSnapshotOptions): void {
  const accumulatedTimeRef = useRef(0)
  const lastSaveStateRef = useRef(saveState)
  const lastSnapshotHashRef = useRef('')

  useEffect(() => {
    if (!enabled) return

    const prev = lastSaveStateRef.current
    lastSaveStateRef.current = saveState

    if (prev === 'saving' && saveState === 'saved') {
      accumulatedTimeRef.current += SAVE_TRANSITION_TIME_S

      if (accumulatedTimeRef.current >= AUTO_SNAPSHOT_INTERVAL_S) {
        const currentHash = computeGraphHash(
          items.map(i => ({ id: i.id, position_x: i.position_x, position_y: i.position_y, sort_order: i.sort_order })),
          edges.map(e => ({ source_item_id: e.source_item_id, target_item_id: e.target_item_id, edge_type: e.edge_type })),
        )

        if (currentHash !== lastSnapshotHashRef.current) {
          lastSnapshotHashRef.current = currentHash
          accumulatedTimeRef.current = 0
          const now = new Date()
          const label = `Auto-save ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
          onCreateSnapshot(siteId, playlistId, 'auto', label).catch(() => {})
        } else {
          accumulatedTimeRef.current = 0
        }
      }
    }
  }, [saveState, enabled, items, edges, playlistId, siteId, onCreateSnapshot])
}
