'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { SnapshotRow, SnapshotType, ActionResult } from '@/lib/playlists/types'

interface VersionHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  siteId: string
  playlistId: string
  onListSnapshots: (siteId: string, playlistId: string, cursor?: string, limit?: number) => Promise<ActionResult<{ snapshots: SnapshotRow[]; hasMore: boolean }>>
  onCreateSnapshot: (siteId: string, playlistId: string, type: SnapshotType, label: string) => Promise<ActionResult<{ id: string | null; deduplicated: boolean }>>
  onRenameSnapshot: (siteId: string, snapshotId: string, label: string) => Promise<ActionResult<void>>
  onDeleteSnapshot: (siteId: string, snapshotId: string) => Promise<ActionResult<void>>
  onPreview: (snapshot: SnapshotRow) => void
}

const TYPE_CONFIG: Record<SnapshotType, { icon: string; border: string; label: string }> = {
  manual: { icon: '📌', border: 'border-l-green-500', label: 'Manual' },
  pre_destructive: { icon: '⚠️', border: 'border-l-amber-500', label: 'Pré-operação' },
  auto: { icon: '🔄', border: 'border-l-blue-500', label: 'Auto-save' },
  session_start: { icon: '🟢', border: 'border-l-cyan-500', label: 'Início da sessão' },
}

export function VersionHistoryPanel({
  isOpen,
  onClose,
  siteId,
  playlistId,
  onListSnapshots,
  onCreateSnapshot,
  onRenameSnapshot,
  onDeleteSnapshot,
  onPreview,
}: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const loadSnapshots = useCallback(async (cursor?: string) => {
    setIsLoading(true)
    const result = await onListSnapshots(siteId, playlistId, cursor)
    if (result.ok) {
      if (cursor) {
        setSnapshots(prev => [...prev, ...result.data.snapshots])
      } else {
        setSnapshots(result.data.snapshots)
      }
      setHasMore(result.data.hasMore)
    }
    setIsLoading(false)
  }, [siteId, playlistId, onListSnapshots])

  useEffect(() => {
    if (isOpen) loadSnapshots()
  }, [isOpen, loadSnapshots])

  function handleCreateCheckpoint() {
    startTransition(async () => {
      const now = new Date()
      const label = `Checkpoint ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      await onCreateSnapshot(siteId, playlistId, 'manual', label)
      await loadSnapshots()
    })
  }

  function handleRename(snapshotId: string) {
    if (!editLabel.trim()) return
    startTransition(async () => {
      await onRenameSnapshot(siteId, snapshotId, editLabel.trim())
      setEditingId(null)
      await loadSnapshots()
    })
  }

  function handleDelete(snapshotId: string) {
    if (!window.confirm('Excluir este snapshot? Essa ação não pode ser desfeita.')) return
    startTransition(async () => {
      await onDeleteSnapshot(siteId, snapshotId)
      await loadSnapshots()
    })
  }

  function handleLoadMore() {
    const last = snapshots[snapshots.length - 1]
    if (last) loadSnapshots(`${last.created_at}|${last.id}`)
  }

  if (!isOpen) return null

  const grouped = groupByDate(snapshots)

  return (
    <div className="flex w-72 flex-col border-l border-white/10 bg-[#111827]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Versões</h2>
        <button
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white/70"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-white/5 px-4 py-3">
        <button
          onClick={handleCreateCheckpoint}
          disabled={isPending}
          className="w-full rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/10 disabled:opacity-50"
        >
          + Criar checkpoint (⌘S)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {grouped.map(([date, items]) => (
          <div key={date} className="mb-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/30">
              {date}
            </div>
            {items.map(snapshot => {
              const config = TYPE_CONFIG[snapshot.type]
              return (
                <div
                  key={snapshot.id}
                  className={`mb-1.5 cursor-pointer rounded-md border-l-2 ${config.border} bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.05]`}
                  onClick={() => onPreview(snapshot)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-white/80">
                      <span>{config.icon}</span>
                      {editingId === snapshot.id ? (
                        <input
                          autoFocus
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(snapshot.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          onBlur={() => handleRename(snapshot.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-32 rounded border border-white/20 bg-black/30 px-1 py-0.5 text-xs text-white outline-none"
                        />
                      ) : (
                        <span className="truncate">{snapshot.label || config.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(snapshot.type === 'manual' || snapshot.type === 'session_start') && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(snapshot.id); setEditLabel(snapshot.label || '') }}
                            className="text-[10px] text-white/30 hover:text-white/60"
                            title="Renomear"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(snapshot.id) }}
                            className="text-[10px] text-white/30 hover:text-red-400"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-white/30">
                    {formatTime(snapshot.created_at)} · {snapshot.stats.item_count}i · {snapshot.stats.edge_count}e
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="w-full rounded-md py-2 text-xs text-white/40 transition-colors hover:text-white/60"
          >
            {isLoading ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}

        {!isLoading && snapshots.length === 0 && (
          <p className="py-8 text-center text-xs text-white/30">Nenhum snapshot ainda</p>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function groupByDate(snapshots: SnapshotRow[]): [string, SnapshotRow[]][] {
  const groups = new Map<string, SnapshotRow[]>()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const s of snapshots) {
    const d = new Date(s.created_at).toDateString()
    const label = d === today ? 'Hoje' : d === yesterday ? 'Ontem' : new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(s)
  }

  return Array.from(groups.entries())
}
