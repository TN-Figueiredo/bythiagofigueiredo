'use client'

import { useTransition } from 'react'

interface CascadeEdge {
  id: string
  target_title: string
  edge_type: string
}

interface CascadeConfirmDialogProps {
  itemTitle: string
  edgeCount: number
  edges: CascadeEdge[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function CascadeConfirmDialog({
  itemTitle,
  edgeCount,
  edges,
  onConfirm,
  onCancel,
}: CascadeConfirmDialogProps) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-[#1a1a2e] p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <h3 className="text-[15px] font-semibold text-red-400">Remover item com conexões</h3>
        </div>

        <p className="mb-2 text-sm font-medium text-white/90">{itemTitle}</p>

        <p className="mb-1 text-[13px] text-amber-400">
          Este item tem <strong>{edgeCount} edge{edgeCount > 1 ? 's' : ''} conectada{edgeCount > 1 ? 's' : ''}</strong> que {edgeCount > 1 ? 'serão removidas' : 'será removida'} junto:
        </p>

        {edges.length > 0 && (
          <div className="my-3 rounded-md bg-black/30 px-3 py-2 text-xs leading-relaxed text-white/60">
            {edges.map(e => (
              <div key={e.id}>→ {e.target_title} ({e.edge_type})</div>
            ))}
            {edgeCount > 5 && (
              <div className="text-white/30">+ {edgeCount - 5} outras edges</div>
            )}
          </div>
        )}

        <p className="mb-4 text-xs text-white/40">
          Um snapshot será criado automaticamente antes da remoção.
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
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Removendo...' : `Remover item + ${edgeCount} edge${edgeCount > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
