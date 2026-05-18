import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getTopFans } from '@/lib/social/actions/fans'
import { FanLeaderboard } from './_components/fan-leaderboard'

export const dynamic = 'force-dynamic'

export default async function FansPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const fans = await getTopFans(siteId, 50)

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cms-bg p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cms-text">Top Fans</h1>
        <p className="text-sm text-cms-text-muted mt-1">Últimos 90 dias</p>
      </div>
      <FanLeaderboard fans={fans} />
    </div>
  )
}
