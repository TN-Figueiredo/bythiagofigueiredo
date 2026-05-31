'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { FreshnessDot } from './freshness-dot'

interface SignalCardProps {
  live?: {
    viewsDelta: number
    likesDelta: number
    polledAt: string
  }
  confirmed?: {
    views: number
    avdSeconds: number
    lastSyncAt: string | null
  }
}

export function SignalCard({ live, confirmed }: SignalCardProps) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-4 space-y-3">
      {/* TOP: Live proxy */}
      {live && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Sinal ao vivo</span>
          </div>
          <div className="flex items-baseline gap-4">
            <Metric label="Views" value={formatDelta(live.viewsDelta)} positive={live.viewsDelta > 0} />
            <Metric label="Likes" value={formatDelta(live.likesDelta)} positive={live.likesDelta > 0} />
          </div>
          <FreshnessDot lastUpdated={live.polledAt} label="Views" />
        </div>
      )}

      {live && confirmed && <div className="border-t border-zinc-700/30" />}

      {/* BOTTOM: Confirmed */}
      {confirmed && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-500" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Confirmado</span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-zinc-300">{confirmed.views.toLocaleString('pt-BR')} views</span>
            <span className="text-sm text-zinc-300">{formatAvd(confirmed.avdSeconds)} AVD</span>
          </div>
          <FreshnessDot lastUpdated={confirmed.lastSyncAt} label="Analytics" />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  const Icon = positive ? TrendingUp : positive === false ? TrendingDown : Minus
  const color = positive ? 'text-green-400' : 'text-zinc-400'
  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${color}`} />
      <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

function formatDelta(n: number): string {
  if (n === 0) return '0'
  return (n > 0 ? '+' : '') + n.toLocaleString('pt-BR')
}

function formatAvd(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
