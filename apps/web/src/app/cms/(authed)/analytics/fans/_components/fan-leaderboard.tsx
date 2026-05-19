'use client'

import type { FanScore } from '@/lib/social/story-types'

interface FanLeaderboardProps {
  fans: FanScore[]
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function obfuscateHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

export function FanLeaderboard({ fans }: FanLeaderboardProps) {
  if (fans.length === 0) {
    return (
      <div className="rounded-lg border border-cms-border bg-cms-surface p-8 text-center">
        <p className="text-cms-text-muted text-sm">
          Nenhum fan registrado ainda. Interações aparecem aqui após os primeiros polls.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider text-cms-text-muted border-b border-cms-border">
        <span>#</span>
        <span>Visitor</span>
        <span className="hidden sm:block">Plataformas</span>
        <span className="text-right">Interações</span>
        <span className="text-right hidden md:block">Último acesso</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-cms-border">
        {fans.map((fan, idx) => {
          const rank = idx + 1
          const rankColor = RANK_COLORS[rank] ?? 'text-cms-text-muted'
          const identifier = fan.email ?? obfuscateHash(fan.visitor_hash)

          return (
            <div
              key={fan.visitor_hash}
              className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-cms-surface/60 transition-colors"
            >
              {/* Rank */}
              <span className={`text-sm font-bold tabular-nums ${rankColor}`}>{rank}</span>

              {/* Identifier */}
              <div className="min-w-0">
                <p className="text-sm text-cms-text truncate font-mono">
                  {identifier}
                </p>
                <p className="text-[10px] text-cms-text-muted mt-0.5">
                  {fan.active_days} dia{fan.active_days !== 1 ? 's' : ''} ativo
                  {fan.platform_count > 1 ? ` · ${fan.platform_count} plataformas` : ''}
                </p>
              </div>

              {/* Platforms (placeholder badges based on platform_count) */}
              <div className="hidden sm:block">
                {fan.platform_count > 0 ? (
                  <span className="text-xs text-cms-text-muted">
                    {fan.platform_count} canal{fan.platform_count !== 1 ? 'is' : ''}
                  </span>
                ) : (
                  <span className="text-xs text-cms-text-muted">—</span>
                )}
              </div>

              {/* Interaction count + score */}
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-cms-text">
                  {fan.total_interactions.toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] text-cms-text-muted">
                  score {fan.score.toFixed(0)}
                </p>
              </div>

              {/* Last seen */}
              <div className="text-right hidden md:block">
                <p className="text-xs text-cms-text-muted tabular-nums">
                  {formatDate(fan.last_seen)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-cms-border">
        <p className="text-[10px] text-cms-text-muted italic">
          Identidade baseada em hash anônimo (LGPD). E-mail exibido apenas quando o visitor optou pelo newsletter.
        </p>
      </div>
    </div>
  )
}
