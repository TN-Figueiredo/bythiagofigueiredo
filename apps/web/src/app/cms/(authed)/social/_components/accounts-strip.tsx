import { checkConnectionHealth } from '@/lib/social/actions'
import { AccountsStripClient } from './accounts-strip-client'

export async function AccountsStripLoader({ siteId }: { siteId: string }) {
  const result = await checkConnectionHealth(siteId)
  if (!result.ok) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-amber-400">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-xs text-amber-400">Nao foi possivel verificar o status das conexoes</p>
      </div>
    )
  }
  if (result.data.length === 0) return null
  return <AccountsStripClient connections={result.data} />
}
