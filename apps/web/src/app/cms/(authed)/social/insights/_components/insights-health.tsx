'use client'

import { PROVIDERS, type Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { OauthButton } from '../../accounts/_components/oauth-button'
import type { SocialStrings } from '../../_i18n/types'

interface HealthConnection {
  provider: Provider
  account_name: string | null
  token_expires_at: string | null
  revoked_at: string | null
}

interface InsightsHealthProps {
  connections: HealthConnection[]
  quotaUsed?: number
  strings: SocialStrings
}

export function InsightsHealth({ connections, quotaUsed = 0, strings: t }: InsightsHealthProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROVIDERS.map(provider => {
          const conn = connections.find(c => c.provider === provider)
          const isExpired = conn?.token_expires_at && new Date(conn.token_expires_at) < new Date()
          const status = !conn ? 'none' : isExpired ? 'expired' : 'healthy'
          const statusColor = status === 'healthy' ? 'text-green-400' : status === 'expired' ? 'text-red-400' : 'text-gray-500'
          const statusLabel = status === 'healthy' ? t.insights.health.healthy : status === 'expired' ? t.insights.health.expired : '—'

          return (
            <div key={provider} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-2">
              <div className="flex items-center gap-2">
                <PlatformIcon provider={provider} size="lg" />
                <span className="font-semibold text-cms-text">{platformLabel(provider)}</span>
              </div>
              <p className={`text-sm ${statusColor}`}>{statusLabel}</p>
              {conn?.token_expires_at && !isExpired && (
                <p className="text-xs text-cms-text-dim">
                  {t.insights.health.tokenExpiry.replace('{days}', String(Math.ceil((new Date(conn.token_expires_at).getTime() - Date.now()) / 86400000)))}
                </p>
              )}
              {provider === 'youtube' && conn && (
                <div className="space-y-1">
                  <p className="text-xs text-cms-text-dim">{t.insights.health.quotaLabel}</p>
                  <div className="h-1.5 rounded-full bg-gray-700">
                    <div className="h-full rounded-full bg-cms-accent" style={{ width: `${Math.min(quotaUsed / 100, 100)}%` }} />
                  </div>
                </div>
              )}
              {status === 'expired' && <OauthButton provider={provider} label={t.insights.health.reconnect} className="w-full justify-center text-xs" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
