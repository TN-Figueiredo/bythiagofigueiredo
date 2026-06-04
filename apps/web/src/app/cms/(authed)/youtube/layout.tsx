import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { YouTubeShell } from './_components/youtube-shell'
import './youtube-motion.css'

export const metadata: Metadata = {
  title: { template: '%s — YouTube | CMS', default: 'YouTube — CMS' },
}

export default async function YouTubeLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServiceClient()
  const { data: connections } = await supabase
    .from('social_connections')
    .select('token_expires_at, refresh_token_enc')
    .eq('provider', 'youtube')
    .is('revoked_at', null)

  // Only warn if token is expiring AND has no refresh token to auto-renew
  const connectionsWithoutRefresh = connections?.filter(c => !c.refresh_token_enc) ?? []
  const soonestExpiry = connectionsWithoutRefresh.length > 0
    ? connectionsWithoutRefresh
        .map(c => new Date(c.token_expires_at as string).getTime())
        .filter(t => t > Date.now())
        .sort((a, b) => a - b)[0]
    : undefined

  const hoursUntilExpiry = soonestExpiry
    ? (soonestExpiry - Date.now()) / 3600000
    : null

  return (
    <div data-cms-section="youtube">
      <YouTubeShell hoursUntilExpiry={hoursUntilExpiry}>
        {children}
      </YouTubeShell>
    </div>
  )
}
