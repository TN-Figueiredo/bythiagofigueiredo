import { checkConnectionHealth } from '@/lib/social/actions'
import { AccountsStripClient } from './accounts-strip-client'

export async function AccountsStripLoader({ siteId }: { siteId: string }) {
  const result = await checkConnectionHealth(siteId)
  if (!result.ok) return null
  if (result.data.length === 0) return null
  return <AccountsStripClient connections={result.data} />
}
