'use client'

import { PROVIDERS, type Provider } from '@tn-figueiredo/social'
import { PlatformCard } from './platform-card'
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

interface ConnectionsGridProps {
  connections: SafeConnection[]
  siteId: string
  strings: SocialStrings
}

export function ConnectionsGrid({ connections, strings: t }: ConnectionsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {PROVIDERS.map(provider => (
        <PlatformCard
          key={provider}
          provider={provider}
          connections={connections.filter(c => c.provider === provider)}
          strings={t}
        />
      ))}
    </div>
  )
}
