'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OauthButton } from './oauth-button'
import { disconnectSocial } from '@/lib/social/actions'
import type { SocialStrings } from '../../_i18n/types'

interface SafeConnection {
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
}

export function PlatformCard({ provider, connections, strings: t }: PlatformCardProps) {
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

  function tokenStatus(conn: SafeConnection): { label: string; color: string } {
    if (!conn.token_expires_at) return { label: t.accounts.connections.tokenNever, color: 'text-gray-400' }
    const expires = new Date(conn.token_expires_at)
    if (expires < new Date()) return { label: t.accounts.connections.tokenExpired, color: 'text-red-400' }
    return { label: t.accounts.connections.tokenOk, color: 'text-green-400' }
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformIcon provider={provider} size="lg" />
          <span className="font-semibold text-cms-text">{platformLabel(provider)}</span>
        </div>
        {connections.length > 0 && (
          <button
            type="button"
            onClick={() => setShowManage(!showManage)}
            className="text-sm text-cms-accent hover:underline"
          >
            {t.accounts.connections.manage}
          </button>
        )}
      </div>

      {connections.length === 0 ? (
        <div className="py-4 text-center">
          <OauthButton provider={provider} label={t.accounts.connections.addAccount} connectingLabel={t.common.connecting} />
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map(conn => {
            const status = tokenStatus(conn)
            return (
              <div key={conn.id} className="flex items-center justify-between rounded-md bg-cms-bg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-cms-text">{conn.account_name ?? conn.account_id}</p>
                  <p className={`text-xs ${status.color}`}>{status.label}</p>
                </div>
                {showManage && (
                  <div className="flex gap-2">
                    {status.color === 'text-red-400' && (
                      <OauthButton provider={provider} label={t.accounts.connections.reconnect} connectingLabel={t.common.connecting} className="text-xs px-2 py-1" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDisconnect(conn.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {t.accounts.connections.disconnect}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {disconnectError && (
            <p role="alert" className="text-sm text-red-400">{disconnectError}</p>
          )}
          {showManage && (
            <OauthButton provider={provider} label={t.accounts.connections.addAccount} connectingLabel={t.common.connecting} className="w-full justify-center" />
          )}
        </div>
      )}
    </div>
  )
}
