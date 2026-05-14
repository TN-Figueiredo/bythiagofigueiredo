'use client'

import type { Provider } from '@tn-figueiredo/social'
import { PlatformCard, MetaPlatformCard } from './platform-card'
import { ConnectionsSummary } from './connections-summary'
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
  const youtube = connections.filter(c => c.provider === 'youtube')
  const facebook = connections.filter(c => c.provider === 'facebook')
  const instagram = connections.filter(c => c.provider === 'instagram')
  const bluesky = connections.filter(c => c.provider === 'bluesky')

  const hasMetaConnections = facebook.length > 0 || instagram.length > 0
  // Group FB+IG when either has at least one connection
  const showMetaGroup = hasMetaConnections

  return (
    <div className="space-y-4">
      <ConnectionsSummary connections={connections} strings={t} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* YouTube — always standalone */}
        <PlatformCard
          provider="youtube"
          connections={youtube}
          strings={t}
        />

        {/* Meta group (Facebook + Instagram) */}
        {showMetaGroup ? (
          <MetaPlatformCard
            facebookConnections={facebook}
            instagramConnections={instagram}
            strings={t}
          />
        ) : (
          <>
            <PlatformCard
              provider="facebook"
              connections={facebook}
              strings={t}
            />
            <PlatformCard
              provider="instagram"
              connections={instagram}
              strings={t}
            />
          </>
        )}

        {/* Bluesky — always standalone */}
        <PlatformCard
          provider="bluesky"
          connections={bluesky}
          strings={t}
        />
      </div>
    </div>
  )
}
