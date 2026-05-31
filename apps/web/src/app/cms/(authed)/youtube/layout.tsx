import type { ReactNode } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { YouTubeShell } from './_components/youtube-shell'

export default async function YouTubeLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServiceClient()
  const { data: connections } = await supabase
    .from('social_connections')
    .select('token_expires_at')
    .eq('provider', 'youtube')
    .is('revoked_at', null)

  const soonestExpiry = connections
    ?.map(c => new Date(c.token_expires_at as string).getTime())
    .filter(t => t > Date.now())
    .sort((a, b) => a - b)[0]

  const hoursUntilExpiry = soonestExpiry
    ? (soonestExpiry - Date.now()) / 3600000
    : null

  return (
    <YouTubeShell hoursUntilExpiry={hoursUntilExpiry}>
      {children}
    </YouTubeShell>
  )
}
