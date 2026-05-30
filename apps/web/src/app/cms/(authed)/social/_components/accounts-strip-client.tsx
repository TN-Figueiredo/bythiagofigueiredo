'use client'

import type { ConnectionHealth } from '@/lib/social/actions'
import Link from 'next/link'

interface AccountsStripClientProps {
  connections: ConnectionHealth[]
}

const PROVIDER_ICONS: Record<string, { bg: string; label: string }> = {
  instagram: { bg: 'bg-[#E8823C]/15', label: 'IG' },
  youtube: { bg: 'bg-[#E0574E]/15', label: 'YT' },
  facebook: { bg: 'bg-[#5B7FD6]/15', label: 'FB' },
  bluesky: { bg: 'bg-sky-500/15', label: 'BS' },
}

function formatFollowers(count: number | null): string {
  if (count == null) return '--'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export function AccountsStripClient({ connections }: AccountsStripClientProps) {
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(252px,1fr))] gap-3">
      {connections.map(conn => {
        const icon = PROVIDER_ICONS[conn.provider] ?? { bg: 'bg-gray-500/15', label: '?' }
        return (
          <div key={conn.connectionId} className="flex items-center gap-3 rounded-xl border border-cms-border bg-cms-surface px-4 py-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${icon.bg} text-sm font-bold`}>
              {icon.label}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cms-text">{conn.accountName}</p>
              <p className="text-xs text-cms-text-muted">{formatFollowers(conn.followersCount)} seguidores</p>
            </div>
            <div className="shrink-0">
              {conn.status === 'ok' && (
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" title="Conectado" />
              )}
              {conn.status === 'warn' && (
                <Link href="/cms/social/accounts" className="text-xs font-medium text-amber-400 hover:text-amber-300">
                  Reconectar
                </Link>
              )}
              {conn.status === 'error' && (
                <Link href="/cms/social/accounts" className="text-xs font-medium text-red-400 hover:text-red-300">
                  Expirado
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
