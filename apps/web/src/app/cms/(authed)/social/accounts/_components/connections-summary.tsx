'use client'

import type { SocialStrings } from '../../_i18n/types'

interface SafeConnection {
  id: string
  provider: string
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  connected_at: string
  revoked_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
}

interface ConnectionsSummaryProps {
  connections: SafeConnection[]
  strings: SocialStrings
}

export function ConnectionsSummary({ connections, strings: t }: ConnectionsSummaryProps) {
  const now = new Date()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  let active = 0
  let expiring = 0
  let expired = 0

  for (const conn of connections) {
    if (!conn.token_expires_at) {
      active++
      continue
    }
    const expiresAt = new Date(conn.token_expires_at)
    if (expiresAt < now) {
      expired++
    } else if (expiresAt.getTime() - now.getTime() < thirtyDaysMs) {
      expiring++
    } else {
      active++
    }
  }

  const total = connections.length

  if (total === 0) return null

  return (
    <div className="flex items-center gap-4 rounded-xl border border-cms-border bg-cms-bg p-4">
      <StatItem label={t.accounts.connections.linkedAccounts} value={total} />
      <Divider />
      <StatItem
        label={t.accounts.connections.tokenOk}
        value={active}
        dotColor="bg-green-500"
      />
      <Divider />
      <StatItem
        label={t.accounts.connections.tokenExpiring}
        value={expiring}
        dotColor="bg-amber-500"
      />
      <Divider />
      <StatItem
        label={t.accounts.connections.tokenExpired}
        value={expired}
        dotColor="bg-red-500"
      />
    </div>
  )
}

function Divider() {
  return <div className="h-8 w-px bg-cms-border" />
}

interface StatItemProps {
  label: string
  value: number
  dotColor?: string
}

function StatItem({ label, value, dotColor }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      {dotColor && (
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
      )}
      <div>
        <p className="text-lg font-bold text-cms-text">{value}</p>
        <p className="text-xs text-cms-text-muted">{label}</p>
      </div>
    </div>
  )
}
