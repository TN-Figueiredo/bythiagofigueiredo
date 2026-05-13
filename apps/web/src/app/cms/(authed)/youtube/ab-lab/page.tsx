import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { AbLabTab } from '../_components/ab-lab-tab'

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const tests: [] = []

  return <AbLabTab tests={tests} />
}
