'use client'

import type { FatigueAlert } from '../queries'

interface FatigueCardProps {
  alert: FatigueAlert
  onCreate: (videoId: string) => void
  onDismiss: (alertId: string) => void
}

export function FatigueCard({ alert, onCreate, onDismiss }: FatigueCardProps) {
  const ctrDrop = alert.expectedCtr > 0
    ? Math.round((1 - alert.actualCtr / alert.expectedCtr) * 100)
    : 0

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
      {/* Thumbnail */}
      <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded">
        {alert.thumbnailUrl ? (
          <img src={alert.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-zinc-800" />
        )}
        <span className="absolute top-0.5 left-0.5 rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white">
          FADIGA
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{alert.videoTitle}</p>
        <p className="text-xs text-red-400">
          Views caiu {ctrDrop}% vs esperado (z={alert.zScore})
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => onCreate(alert.videoId)}
          className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-500"
        >
          Testar
        </button>
        <button
          onClick={() => onDismiss(alert.id)}
          className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-600"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
