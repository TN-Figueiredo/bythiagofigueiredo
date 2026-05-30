'use client'

import type { ConnectionHealth } from '@/lib/social/actions'
import Link from 'next/link'

interface AccountsStripClientProps {
  connections: ConnectionHealth[]
}

function PlatformIcon({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    instagram: '#E8823C',
    youtube: '#E0574E',
    facebook: '#5B7FD6',
    bluesky: '#0085FF',
  }
  const bg = colors[provider] ?? '#888'

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
      style={{ background: bg }}
    >
      {provider === 'instagram' && (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
        </svg>
      )}
      {provider === 'youtube' && (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <path d="M10 9l5 3-5 3z" fill="#fff" stroke="none" />
        </svg>
      )}
      {provider === 'facebook' && (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M13.5 8.5h1.6M13.5 8.5c0-1.2.5-2 2-2M13.5 8.5V18M13.5 12h3" />
        </svg>
      )}
      {provider === 'bluesky' && (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <path d="M12 4c3 2.5 6 6 6 8.5a3.5 3.5 0 01-7 0" />
          <path d="M12 4c-3 2.5-6 6-6 8.5a3.5 3.5 0 007 0" />
          <path d="M8.5 17c1-.5 2.5-1 3.5-1s2.5.5 3.5 1" />
        </svg>
      )}
    </div>
  )
}

function formatFollowerCount(count: number | null): string {
  if (count == null) return '--'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2).replace('.', ',')} mi`
  if (count >= 1_000) return `${(count / 1_000).toFixed(2).replace('.', ',')} mil`
  return new Intl.NumberFormat('pt-BR').format(count)
}

function getSubtitle(conn: ConnectionHealth): { text: string; isWarn: boolean } {
  if (conn.status === 'warn' && conn.tokenExpiresIn != null) {
    return { text: `Token expira em ${conn.tokenExpiresIn} dias — reconectar`, isWarn: true }
  }
  if (conn.status === 'error') {
    return { text: 'Token expirado — reconectar', isWarn: true }
  }

  const parts: string[] = []
  if (conn.provider === 'instagram') parts.push('Story + Feed')
  else if (conn.provider === 'youtube') parts.push('Aba Comunidade liberada')
  else if (conn.provider === 'facebook') parts.push('Fanpage')
  parts.push('token válido')
  return { text: parts.join(' · '), isWarn: false }
}

export function AccountsStripClient({ connections }: AccountsStripClientProps) {
  return (
    <div className="mb-[26px] grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(252px,1fr))]">
      {connections.map(conn => {
        const subtitle = getSubtitle(conn)
        return (
          <div
            key={conn.connectionId}
            className="flex items-center gap-[11px] rounded-[var(--radius,12px)] border border-cms-border bg-cms-surface p-[14px] transition-[border-color,transform,background] duration-[180ms]"
          >
            <PlatformIcon provider={conn.provider} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-[7px] text-[13px] font-semibold text-cms-text truncate">
                {conn.accountName}
                {conn.status === 'warn' && (
                  <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-amber-400" />
                )}
              </div>
              <div
                className={`mt-0.5 truncate text-[11px] ${
                  subtitle.isWarn ? 'text-amber-400' : 'text-cms-text-dim'
                }`}
              >
                {!subtitle.isWarn && (
                  <>
                    <span className="font-mono text-cms-text">{formatFollowerCount(conn.followersCount)}</span>
                    <span> · </span>
                  </>
                )}
                {subtitle.text}
              </div>
            </div>
            <div className="shrink-0">
              {conn.status === 'ok' && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-green-500"
                  role="img"
                  aria-label="Conectado"
                />
              )}
              {(conn.status === 'warn' || conn.status === 'error') && (
                <Link
                  href={
                    conn.provider === 'youtube' ? '/cms/youtube'
                    : conn.provider === 'instagram' ? '/cms/settings'
                    : '/cms/social/accounts'
                  }
                  className="inline-flex items-center gap-[7px] rounded-[9px] border border-cms-border px-[11px] py-1.5 text-[12.5px] font-semibold text-cms-text-dim tracking-[-0.01em] transition-colors hover:text-cms-text"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0115-6.7L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 01-15 6.7L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                  Reconectar
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
