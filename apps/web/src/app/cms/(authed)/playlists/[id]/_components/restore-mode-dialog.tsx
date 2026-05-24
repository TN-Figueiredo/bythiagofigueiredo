'use client'

import { useState, useTransition } from 'react'
import type { RestoreMode, SnapshotRow } from '@/lib/playlists/types'

interface RestoreModeDialogProps {
  snapshot: SnapshotRow
  currentItemCount: number
  currentEdgeCount: number
  onRestore: (mode: RestoreMode) => Promise<void>
  onCancel: () => void
}

const MODES: { value: RestoreMode; title: string; description: string }[] = [
  { value: 'full', title: 'Restaurar tudo', description: 'Items, edges e posições' },
  { value: 'edges_only', title: 'Apenas edges', description: 'Manter items/posições atuais, restaurar conexões' },
  { value: 'positions_only', title: 'Apenas posições', description: 'Manter items/edges atuais, restaurar layout' },
]

export function RestoreModeDialog({
  snapshot,
  currentItemCount,
  currentEdgeCount,
  onRestore,
  onCancel,
}: RestoreModeDialogProps) {
  const [mode, setMode] = useState<RestoreMode>('full')
  const [isPending, startTransition] = useTransition()

  const diffItems = snapshot.stats.item_count - currentItemCount
  const diffEdges = snapshot.stats.edge_count - currentEdgeCount

  function handleRestore() {
    startTransition(async () => {
      await onRestore(mode)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-blue-500/30 bg-[#1a1a2e] p-6">
        <h3 className="mb-1 text-[15px] font-semibold text-white">Restaurar snapshot</h3>
        <p className="mb-4 text-xs text-white/50">
          &quot;{snapshot.label}&quot; — {formatDateTime(snapshot.created_at)}
        </p>

        <div className="mb-4 space-y-2">
          {MODES.map(m => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                mode === m.value
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="restoreMode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-white">{m.title}</div>
                <div className="text-xs text-white/50">{m.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-4 rounded-md bg-black/30 px-3 py-2 text-xs text-white/50">
          <div>Items: {snapshot.stats.item_count} ({diffItems >= 0 ? '+' : ''}{diffItems} vs atual)</div>
          <div>Edges: {snapshot.stats.edge_count} ({diffEdges >= 0 ? '+' : ''}{diffEdges} vs atual)</div>
        </div>

        <p className="mb-4 text-[11px] text-white/30">
          Um snapshot do estado atual será criado automaticamente antes da restauração.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Restaurando...' : 'Restaurar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
