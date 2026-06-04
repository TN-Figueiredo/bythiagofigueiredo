'use client'

import { Activity } from 'lucide-react'

interface SignalCardProps {
  live?: {
    viewsDelta: number
    likesDelta: number
    commentsDelta?: number
    polledAt: string
  }
}

function elapsedText(polledAt: string): string {
  const elapsed = Date.now() - new Date(polledAt).getTime()
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `há ${hours}h`
}

export function SignalCard({ live }: SignalCardProps) {
  return (
    <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden">
      {/* card-head */}
      <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
        <Activity size={15} className="text-cms-text-dim" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-cms-text">Sinal ao vivo</span>
        {live && (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-cms-green-subtle px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-wider text-cms-green ml-auto">
            <span className="relative flex h-[5px] w-[5px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--cms-green)' }} />
              <span className="relative inline-flex rounded-full h-[5px] w-[5px]" style={{ background: 'var(--cms-green)' }} />
            </span>
            ao vivo · {elapsedText(live.polledAt)}
          </span>
        )}
      </div>

      {/* card-pad */}
      <div className="flex gap-[24px] px-[16px] py-[14px]">
        <DeltaCol label="Δ Views" value={live?.viewsDelta ?? 0} />
        <DeltaCol label="Δ Curtidas" value={live?.likesDelta ?? 0} />
        {live?.commentsDelta != null && (
          <DeltaCol label="Δ Comentários" value={live.commentsDelta} />
        )}
      </div>
    </div>
  )
}

function DeltaCol({ label, value }: { label: string; value: number }) {
  const cls = value > 0 ? 'text-cms-green' : value < 0 ? 'text-cms-red' : 'text-cms-text-muted'
  return (
    <div>
      <span className="eyebrow">{label}</span>
      <span className={`block font-mono text-[22px] font-bold leading-none tracking-tight mt-[4px] ${cls}`}>
        {value > 0 ? '+' : ''}{value === 0 ? '0' : value.toLocaleString('pt-BR')}
      </span>
    </div>
  )
}
