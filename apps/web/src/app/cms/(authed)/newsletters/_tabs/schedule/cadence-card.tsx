'use client'

import { Pause, Play } from 'lucide-react'
import type { CadenceConfig } from '../../_hub/hub-types'

interface CadenceCardProps {
  config: CadenceConfig
  onTogglePause?: (typeId: string, paused: boolean) => void
}

export function CadenceCard({ config, onTogglePause }: CadenceCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: config.typeColor }} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-gray-200">{config.typeName}</div>
        <div className="text-[9px] text-gray-500">{config.cadence} · {config.time}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] tabular-nums text-gray-400">{config.subscribers} subs</div>
        <div className="text-[9px] text-gray-600">{config.openRate.toFixed(0)}% open rate</div>
      </div>
      {config.conflicts.length > 0 && (
        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
          {config.conflicts.length} conflict{config.conflicts.length > 1 ? 's' : ''}
        </span>
      )}
      <button
        onClick={() => onTogglePause?.(config.typeId, !config.paused)}
        className={`flex h-7 w-7 items-center justify-center rounded-md border ${
          config.paused ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/20' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
        }`}
        aria-label={config.paused ? 'Resume cadence' : 'Pause cadence'}
      >
        {config.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
    </div>
  )
}
