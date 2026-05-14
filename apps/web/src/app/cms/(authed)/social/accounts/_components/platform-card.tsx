'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OauthButton } from './oauth-button'
import { disconnectSocial } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafeConnection {
  id: string
  provider: Provider
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  connected_at: string
  revoked_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
}

interface PlatformCardProps {
  provider: Provider
  connections: SafeConnection[]
  strings: SocialStrings
  /** When true, renders as a sub-card inside a Meta group */
  nested?: boolean
  /** Hide the token bar (shared bar rendered by parent) */
  hideTokenBar?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT_BARS: Record<Provider, string> = {
  youtube: 'bg-gradient-to-r from-red-600 to-red-700',
  facebook: 'bg-gradient-to-r from-blue-600 to-blue-700',
  instagram: 'bg-gradient-to-r from-orange-400 via-pink-600 to-purple-700',
  bluesky: 'bg-gradient-to-r from-blue-500 to-blue-600',
}

const AVATAR_GRADIENTS: Record<Provider, string> = {
  youtube: 'from-red-500 to-red-700',
  facebook: 'from-blue-500 to-blue-700',
  instagram: 'from-orange-400 via-pink-500 to-purple-600',
  bluesky: 'from-blue-400 to-blue-600',
}

const NESTED_BORDERS: Record<Provider, string> = {
  youtube: 'border-l-red-500',
  facebook: 'border-l-blue-500',
  instagram: 'border-l-pink-500',
  bluesky: 'border-l-blue-400',
}

const PLATFORM_TYPES: Record<Provider, string> = {
  youtube: 'channel',
  facebook: 'page',
  instagram: 'account',
  bluesky: 'account',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: unknown): string {
  if (typeof n !== 'number' && typeof n !== 'string') return '—'
  const num = typeof n === 'string' ? parseInt(n, 10) : n
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type TokenHealth = {
  status: 'active' | 'expiring' | 'expired' | 'never'
  daysLeft: number | null
  percent: number
  label: string
  colorClass: string
  textClass: string
  barClass: string
}

function getTokenHealth(expiresAt: string | null, t: SocialStrings): TokenHealth {
  if (!expiresAt) {
    return {
      status: 'never',
      daysLeft: null,
      percent: 100,
      label: t.accounts.connections.neverExpires,
      colorClass: 'text-gray-400',
      textClass: 'text-gray-400',
      barClass: 'bg-gray-500/30',
    }
  }

  const now = new Date()
  const expires = new Date(expiresAt)
  const msLeft = expires.getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  if (daysLeft <= 0) {
    return {
      status: 'expired',
      daysLeft: 0,
      percent: 0,
      label: t.accounts.connections.tokenExpired,
      colorClass: 'text-red-400',
      textClass: 'text-red-400',
      barClass: 'bg-red-500',
    }
  }

  if (daysLeft <= 30) {
    const pct = Math.max(10, Math.round(30 + (daysLeft / 30) * 30))
    return {
      status: 'expiring',
      daysLeft,
      percent: pct,
      label: `${formatDate(expiresAt)}`,
      colorClass: 'text-amber-400',
      textClass: 'text-amber-400',
      barClass: 'bg-amber-500',
    }
  }

  const pct = Math.min(100, Math.round(85 + (daysLeft / 365) * 15))
  return {
    status: 'active',
    daysLeft,
    percent: pct,
    label: formatDate(expiresAt),
    colorClass: 'text-green-400',
    textClass: 'text-green-400',
    barClass: 'bg-green-500',
  }
}

function getAvatarUrl(conn: SafeConnection): string | null {
  const m = conn.metadata
  if (typeof m?.thumbnail_url === 'string') return m.thumbnail_url
  if (typeof m?.picture_url === 'string') return m.picture_url
  if (typeof m?.profile_picture_url === 'string') return m.profile_picture_url
  return null
}

function getHandle(conn: SafeConnection): { text: string; href: string } | null {
  const m = conn.metadata
  if (conn.provider === 'youtube' && typeof m?.custom_url === 'string') {
    return { text: m.custom_url, href: `https://youtube.com/${m.custom_url}` }
  }
  if (conn.provider === 'facebook' && typeof m?.page_name === 'string') {
    return { text: m.page_name as string, href: `https://facebook.com/${m.page_name as string}` }
  }
  if (conn.provider === 'instagram' && typeof m?.ig_username === 'string') {
    return { text: `@${m.ig_username}`, href: `https://instagram.com/${m.ig_username as string}` }
  }
  return null
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

interface StatConfig {
  label: string
  value: unknown
}

function getStats(conn: SafeConnection, t: SocialStrings): StatConfig[] {
  const m = conn.metadata
  const c = t.accounts.connections
  switch (conn.provider) {
    case 'youtube':
      return [
        { label: c.subscribers, value: m?.subscriber_count },
        { label: c.videos, value: m?.video_count },
        { label: c.views, value: m?.view_count },
      ]
    case 'facebook':
      return [
        { label: c.pageLikes, value: m?.fan_count },
        { label: c.followers, value: m?.follower_count },
        { label: c.posts, value: null },
      ]
    case 'instagram':
      return [
        { label: c.followers, value: m?.followers_count },
        { label: c.posts, value: m?.media_count },
        { label: c.media, value: null },
      ]
    case 'bluesky':
      return [
        { label: c.followers, value: null },
        { label: c.posts, value: null },
        { label: c.media, value: null },
      ]
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ health }: { health: TokenHealth }) {
  const styles: Record<TokenHealth['status'], string> = {
    active: 'bg-green-500/10 text-green-400',
    expiring: 'bg-amber-500/10 text-amber-400',
    expired: 'bg-red-500/10 text-red-400',
    never: 'bg-green-500/10 text-green-400',
  }
  const labels: Record<TokenHealth['status'], string> = {
    active: 'Active',
    expiring: 'Expiring',
    expired: 'Expired',
    never: 'Active',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[health.status]}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {labels[health.status]}
    </span>
  )
}

function AccountAvatar({
  conn,
  health,
}: {
  conn: SafeConnection
  health: TokenHealth
}) {
  const avatarUrl = getAvatarUrl(conn)
  const isExpired = health.status === 'expired'
  const gradient = AVATAR_GRADIENTS[conn.provider]

  const indicatorColor = isExpired ? 'bg-red-500' : 'bg-green-500'
  const indicatorIcon = isExpired ? '!' : '✓'

  return (
    <div className="relative flex-shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className={`h-12 w-12 rounded-full object-cover ${isExpired ? 'opacity-70 ring-2 ring-red-500/50' : 'ring-2 ring-cms-border'}`}
        />
      ) : (
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-bold text-white ${isExpired ? 'opacity-70' : ''}`}
        >
          {getInitials(conn.account_name)}
        </div>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${indicatorColor} ring-2 ring-cms-surface`}
      >
        {indicatorIcon}
      </span>
    </div>
  )
}

function StatsGrid({
  stats,
  dimmed,
}: {
  stats: StatConfig[]
  dimmed: boolean
}) {
  return (
    <div className={`grid grid-cols-3 gap-3 ${dimmed ? 'opacity-50' : ''}`}>
      {stats.map(stat => (
        <div key={stat.label} className="rounded-lg bg-cms-bg px-3 py-2 text-center">
          <p className="text-sm font-semibold text-cms-text">{formatNumber(stat.value)}</p>
          <p className="text-[11px] text-cms-text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function TokenHealthBar({ health }: { health: TokenHealth }) {
  if (health.status === 'never') {
    return (
      <div className="text-xs text-gray-400">
        {health.label}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-cms-text-muted">Token</span>
        <span className={health.textClass}>
          {health.status === 'expiring' && '⚠ '}
          {health.label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cms-border/50">
        <div
          className={`h-full rounded-full transition-all ${health.barClass}`}
          style={{ width: `${health.percent}%` }}
        />
      </div>
    </div>
  )
}

function ExpiredBanner({
  conn,
  health,
  t,
}: {
  conn: SafeConnection
  health: TokenHealth
  t: SocialStrings
}) {
  if (health.status !== 'expired') return null

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
      <div className="flex items-start gap-2">
        <span className="text-sm">{'⚠️'}</span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-red-400">
            {t.accounts.connections.tokenExpired}
          </p>
          <p className="text-xs text-cms-text-muted">
            Reconnect to resume publishing
          </p>
          <OauthButton
            provider={conn.provider}
            label={t.accounts.connections.reconnect}
            connectingLabel={t.common.connecting}
            className="mt-1 text-xs px-2 py-1"
          />
        </div>
      </div>
    </div>
  )
}

function ManageDetails({
  conn,
  health,
  t,
  onDisconnect,
  isPending,
}: {
  conn: SafeConnection
  health: TokenHealth
  t: SocialStrings
  onDisconnect: (id: string) => void
  isPending: boolean
}) {
  return (
    <div className="space-y-3 border-t border-cms-border/50 pt-3">
      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-cms-text-muted">Account ID</p>
          <p className="font-mono text-cms-text truncate" title={conn.account_id}>
            {conn.account_id}
          </p>
        </div>
        <div>
          <p className="text-cms-text-muted">{t.accounts.connections.connectedOn}</p>
          <p className="text-cms-text">{formatDateTime(conn.connected_at)}</p>
        </div>
        <div>
          <p className="text-cms-text-muted">Token expiry</p>
          <p className={health.textClass}>
            {health.label}
            {health.daysLeft !== null && health.daysLeft > 0 && ` (${health.daysLeft}d)`}
          </p>
        </div>
        <div>
          <p className="text-cms-text-muted">Scopes</p>
          <div className="flex flex-wrap gap-1">
            {conn.scopes.length > 0 ? (
              conn.scopes.map(scope => (
                <span
                  key={scope}
                  className="inline-block rounded bg-cms-border/50 px-1.5 py-0.5 text-[10px] text-cms-text-muted"
                >
                  {scope}
                </span>
              ))
            ) : (
              <span className="text-cms-text-muted">{'—'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {health.status === 'expired' && (
          <OauthButton
            provider={conn.provider}
            label={t.accounts.connections.reconnect}
            connectingLabel={t.common.connecting}
            className="text-xs px-2 py-1"
          />
        )}
        <button
          type="button"
          onClick={() => onDisconnect(conn.id)}
          disabled={isPending}
          className="rounded-md border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {t.accounts.connections.disconnect}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AccountCard (single connection)
// ---------------------------------------------------------------------------

function AccountCard({
  conn,
  showManage,
  t,
  onDisconnect,
  isPending,
}: {
  conn: SafeConnection
  showManage: boolean
  t: SocialStrings
  onDisconnect: (id: string) => void
  isPending: boolean
}) {
  const health = getTokenHealth(conn.token_expires_at, t)
  const isExpired = health.status === 'expired'
  const handle = getHandle(conn)
  const stats = getStats(conn, t)

  return (
    <div
      className={`space-y-3 rounded-lg bg-cms-bg p-4 ${isExpired ? 'border border-red-500/20' : ''}`}
    >
      {/* Avatar row */}
      <div className="flex items-start gap-3">
        <AccountAvatar conn={conn} health={health} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-cms-text">
              {conn.account_name ?? conn.account_id}
            </p>
            <StatusBadge health={health} />
          </div>
          {handle && (
            <a
              href={handle.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 text-xs text-cms-text-muted hover:text-cms-accent"
            >
              {handle.text}
              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                {'↗'}
              </span>
            </a>
          )}
          <p className="text-[11px] text-cms-text-muted">
            {t.accounts.connections.connectedOn} {formatDate(conn.connected_at)}
          </p>
        </div>
      </div>

      {/* Expired banner */}
      <ExpiredBanner conn={conn} health={health} t={t} />

      {/* Stats grid */}
      <StatsGrid stats={stats} dimmed={isExpired} />

      {/* Token health bar */}
      <TokenHealthBar health={health} />

      {/* Manage details */}
      {showManage && (
        <ManageDetails
          conn={conn}
          health={health}
          t={t}
          onDisconnect={onDisconnect}
          isPending={isPending}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlatformCard (outer card per provider)
// ---------------------------------------------------------------------------

export function PlatformCard({
  provider,
  connections,
  strings: t,
  nested = false,
  hideTokenBar: _hideTokenBar = false,
}: PlatformCardProps) {
  const router = useRouter()
  const [showManage, setShowManage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  function handleDisconnect(connectionId: string) {
    if (!confirm(t.accounts.connections.disconnectConfirm)) return
    setDisconnectError(null)
    startTransition(async () => {
      try {
        const result = await disconnectSocial(connectionId)
        if (!result.ok) {
          setDisconnectError(result.error ?? t.common.error)
        } else {
          router.refresh()
        }
      } catch {
        setDisconnectError(t.common.error)
      }
    })
  }

  const type = PLATFORM_TYPES[provider]
  const hasConnections = connections.length > 0

  // Nested mode: simplified card without accent bar (used in Meta group)
  if (nested) {
    return (
      <div className={`space-y-3 border-l-2 ${NESTED_BORDERS[provider]} pl-4`}>
        <div className="flex items-center gap-2">
          <PlatformIcon provider={provider} size="md" />
          <span className="text-sm font-medium text-cms-text">{platformLabel(provider)}</span>
        </div>
        {connections.map(conn => (
          <AccountCard
            key={conn.id}
            conn={conn}
            showManage={showManage}
            t={t}
            onDisconnect={handleDisconnect}
            isPending={isPending}
          />
        ))}
        {connections.length === 0 && (
          <div className="py-2">
            <OauthButton
              provider={provider}
              label={t.accounts.connections.addAccount}
              connectingLabel={t.common.connecting}
              className="text-xs"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-transform hover:-translate-y-0.5">
      {/* Accent bar */}
      <div className={`h-[3px] ${ACCENT_BARS[provider]}`} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <PlatformIcon provider={provider} size="lg" />
          <span className="text-base font-semibold text-cms-text">{platformLabel(provider)}</span>
          {hasConnections && (
            <span className="rounded-full bg-cms-bg px-2 py-0.5 text-xs text-cms-text-muted">
              {connections.length} {type}{connections.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasConnections && (
            <>
              <OauthButton
                provider={provider}
                label={`+ Add ${type}`}
                connectingLabel={t.common.connecting}
                className="text-xs bg-transparent !text-cms-accent hover:!bg-cms-accent/10 !px-2 !py-1"
              />
              <button
                type="button"
                onClick={() => setShowManage(!showManage)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  showManage
                    ? 'bg-cms-accent/10 text-cms-accent'
                    : 'text-cms-text-muted hover:text-cms-text hover:bg-cms-bg'
                }`}
              >
                {t.accounts.connections.manage}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {!hasConnections ? (
          /* Empty state */
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-cms-border">
              <PlatformIcon provider={provider} size="lg" className="opacity-40" />
            </div>
            <p className="text-sm font-medium text-cms-text">
              Connect your {platformLabel(provider)} account
            </p>
            <p className="mb-4 text-xs text-cms-text-muted">
              Manage and publish content directly from your CMS
            </p>
            <OauthButton
              provider={provider}
              label={t.accounts.connections.addAccount}
              connectingLabel={t.common.connecting}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map(conn => (
              <AccountCard
                key={conn.id}
                conn={conn}
                showManage={showManage}
                t={t}
                onDisconnect={handleDisconnect}
                isPending={isPending}
              />
            ))}

            {disconnectError && (
              <p role="alert" className="text-sm text-red-400">
                {disconnectError}
              </p>
            )}

            {showManage && (
              <button
                type="button"
                onClick={() => {
                  /* Trigger OAuth for adding another */
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-cms-border py-3 text-sm text-cms-text-muted hover:border-cms-accent hover:text-cms-accent transition-colors"
              >
                + {t.accounts.connections.addAnother} {platformLabel(provider)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetaPlatformCard (combined Facebook + Instagram)
// ---------------------------------------------------------------------------

interface MetaPlatformCardProps {
  facebookConnections: SafeConnection[]
  instagramConnections: SafeConnection[]
  strings: SocialStrings
}

export function MetaPlatformCard({
  facebookConnections,
  instagramConnections,
  strings: t,
}: MetaPlatformCardProps) {
  const router = useRouter()
  const [showManage, setShowManage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  function handleDisconnect(connectionId: string) {
    if (!confirm(t.accounts.connections.disconnectConfirm)) return
    setDisconnectError(null)
    startTransition(async () => {
      try {
        const result = await disconnectSocial(connectionId)
        if (!result.ok) {
          setDisconnectError(result.error ?? t.common.error)
        } else {
          router.refresh()
        }
      } catch {
        setDisconnectError(t.common.error)
      }
    })
  }

  const allConnections = [...facebookConnections, ...instagramConnections]
  const hasConnections = allConnections.length > 0

  // Pick the shared token expiry from any connection (they share the Meta token)
  const sharedToken = allConnections.find(c => c.token_expires_at)?.token_expires_at ?? null
  const sharedHealth = getTokenHealth(sharedToken, t)

  return (
    <div className="group overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-transform hover:-translate-y-0.5">
      {/* Combined accent bar: blue left + IG gradient right */}
      <div className="flex h-[3px]">
        <div className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700" />
        <div className="flex-1 bg-gradient-to-r from-orange-400 via-pink-600 to-purple-700" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <PlatformIcon provider="facebook" size="lg" />
          <PlatformIcon provider="instagram" size="lg" />
          <span className="text-base font-semibold text-cms-text">Meta</span>
          {hasConnections && (
            <span className="rounded-full bg-cms-bg px-2 py-0.5 text-xs text-cms-text-muted">
              {allConnections.length} {t.accounts.connections.linkedAccounts.toLowerCase()}
            </span>
          )}
        </div>
        {hasConnections && (
          <button
            type="button"
            onClick={() => setShowManage(!showManage)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showManage
                ? 'bg-cms-accent/10 text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text hover:bg-cms-bg'
            }`}
          >
            {t.accounts.connections.manage}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-4 space-y-4">
        {/* Shared token notice */}
        {hasConnections && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-500/5 px-3 py-2 text-xs text-cms-text-muted">
            <span>{'🔗'}</span>
            {t.accounts.connections.metaSharedToken}
          </div>
        )}

        {/* Facebook sub-card */}
        <PlatformCard
          provider="facebook"
          connections={facebookConnections}
          strings={t}
          nested
          hideTokenBar
        />

        {/* Instagram sub-card */}
        <PlatformCard
          provider="instagram"
          connections={instagramConnections}
          strings={t}
          nested
          hideTokenBar
        />

        {disconnectError && (
          <p role="alert" className="text-sm text-red-400">
            {disconnectError}
          </p>
        )}

        {/* Shared token health bar */}
        {hasConnections && (
          <div className="border-t border-cms-border/50 pt-3">
            <TokenHealthBar health={sharedHealth} />
          </div>
        )}

        {showManage && hasConnections && (
          <div className="space-y-2">
            {allConnections.map(conn => (
              <ManageDetails
                key={conn.id}
                conn={conn}
                health={getTokenHealth(conn.token_expires_at, t)}
                t={t}
                onDisconnect={handleDisconnect}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
