import { checkConnectionHealth } from '@/lib/social/actions'
import { AccountsStripClient } from './accounts-strip-client'

export async function AccountsStripLoader({ siteId }: { siteId: string }) {
  const result = await checkConnectionHealth(siteId)
  if (!result.ok) {
    return (
      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-400">
        Nao foi possivel verificar o status das conexoes
      </div>
    )
  }
  if (result.data.length === 0) return null
  return <AccountsStripClient connections={result.data} />
}
